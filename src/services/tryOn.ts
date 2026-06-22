// Virtual try-on via a Hugging Face Gradio Space.
//
// We don't use @gradio/client because it relies on browser EventSource which
// isn't available in React Native. Instead we hit the Gradio REST API directly:
//
//   1. POST /gradio_api/upload       — upload person + garment blobs
//   2. POST /gradio_api/call/<fn>    — enqueue the prediction, returns event_id
//   3. GET  /gradio_api/call/<fn>/<event_id> — SSE stream; we read it as one
//      text payload once the server closes the connection (prediction done),
//      then parse the `complete` event out of it.
//
// Configure via .env.local:
//   EXPO_PUBLIC_HF_TOKEN=hf_xxx
//   EXPO_PUBLIC_TRYON_SPACE=Kwai-Kolors/Kolors-Virtual-Try-On
//   EXPO_PUBLIC_TRYON_ENDPOINT=tryon    (Gradio api_name, default "tryon")

import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const TOKEN = process.env.EXPO_PUBLIC_HF_TOKEN;
const SPACE = process.env.EXPO_PUBLIC_TRYON_SPACE || 'Kwai-Kolors/Kolors-Virtual-Try-On';
const ENDPOINT = process.env.EXPO_PUBLIC_TRYON_ENDPOINT || 'tryon';

// ─── In-memory log so the UI can show every step + error in a copyable modal ───
const logLines: string[] = [];
const listeners = new Set<(lines: string[]) => void>();
function log(line: string) {
  const stamped = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  logLines.push(stamped);
  if (logLines.length > 200) logLines.shift();
  console.log(stamped);
  listeners.forEach(l => l([...logLines]));
}
export function subscribeTryOnLog(fn: (lines: string[]) => void) {
  listeners.add(fn);
  fn([...logLines]);
  return () => listeners.delete(fn);
}
export function clearTryOnLog() {
  logLines.length = 0;
  listeners.forEach(l => l([]));
}
export function getTryOnLog() { return [...logLines]; }

function previewVal(v: unknown): string {
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 77) + '...' : v;
  if (v == null) return String(v);
  if (typeof v === 'object') {
    try { return JSON.stringify(v).slice(0, 80); } catch { return '[object]'; }
  }
  return String(v);
}

// Normalize whatever the caller passes (string URL, { uri }, or a require()'d
// asset module number) into a plain string URL. Without this guard, a non-string
// blows up inside `startsWith`.
function coerceUri(input: unknown, label: string): string {
  if (typeof input === 'string' && input.length > 0) return input;
  try {
    if (typeof input === 'number') {
      const resolved = Image.resolveAssetSource(input as any);
      if (resolved?.uri) return resolved.uri;
    }
    if (input && typeof input === 'object') {
      const anyIn = input as any;
      if (typeof anyIn.uri === 'string' && anyIn.uri.length > 0) return anyIn.uri;
      if (typeof anyIn.url === 'string' && anyIn.url.length > 0) return anyIn.url;
      const resolved = Image.resolveAssetSource(anyIn);
      if (resolved?.uri) return resolved.uri;
    }
  } catch { /* fall through */ }
  const preview = typeof input === 'object' ? JSON.stringify(input).slice(0, 80) : String(input);
  throw new Error(`${label}: bad image input → ${preview}`);
}

// RN's FormData multipart upload requires a local `file://` URI. If the caller
// hands us a remote URL (e.g. a product image on a CDN), we have to download
// it to the app's cache directory first — passing an `https://` URI in
// FormData triggers an "Unsupported JSI" error on some platforms.
async function toLocalFile(rawUri: unknown, suggestedName: string): Promise<string> {
  const uri = coerceUri(rawUri, suggestedName);
  log(`toLocalFile ${suggestedName} uri=${uri.slice(0, 120)}`);
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://') || uri.startsWith('data:')) {
    return uri;
  }
  if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
    throw new Error(`${suggestedName}: unsupported URI scheme → ${uri.slice(0, 60)}`);
  }
  const ext = guessExt(uri, suggestedName);
  const dest = `${FileSystem.cacheDirectory}tryon-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
  try {
    const res = await FileSystem.downloadAsync(uri, dest);
    log(`downloaded ${suggestedName} status=${res?.status} uri=${res?.uri}`);
    if (!res?.uri) throw new Error(`${suggestedName}: download returned no file URI`);
    if (res.status && res.status >= 400) throw new Error(`${suggestedName}: download HTTP ${res.status}`);
    return res.uri;
  } catch (e: any) {
    throw new Error(`${suggestedName}: download failed — ${e?.message || String(e)}`);
  }
}

function guessExt(uri: string, name: string): string {
  const n = (uri + ' ' + name).toLowerCase();
  if (n.includes('.png')) return 'png';
  if (n.includes('.webp')) return 'webp';
  if (n.includes('.heic') || n.includes('.heif')) return 'heic';
  return 'jpg';
}

const BASE = `https://${SPACE.replace('/', '-').toLowerCase()}.hf.space`;

const authHeaders = (): Record<string, string> =>
  TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

type GradioFile = {
  path: string;
  url: string;
  orig_name: string;
  meta: { _type: 'gradio.FileData' };
};

async function uploadFile(uri: unknown, name: string): Promise<GradioFile> {
  // Remote URLs must be pulled down first so FormData only sees a file:// path.
  const localUri = await toLocalFile(uri, name);
  // React Native's FormData file shape: { uri, name, type } — NOT a Blob.
  const form = new FormData();
  form.append('files', {
    uri: localUri,
    name,
    type: guessMime(localUri, name),
  } as any);

  // Try the Gradio 5 path first (/gradio_api/upload); fall back to the bare
  // /upload used by Gradio 4.x Spaces (like IDM-VTON).
  const uploadPaths = ['/gradio_api/upload', '/upload'];
  log(`uploading ${name} (trying ${uploadPaths.join(', ')})`);
  let res: Response | null = null;
  let lastStatus = 0;
  let lastBody = '';
  for (const path of uploadPaths) {
    try {
      const r = await fetch(`${BASE}${path}`, {
        method: 'POST',
        body: form as any,
        headers: { ...authHeaders() },
      });
      if (r.ok) { res = r; log(`upload succeeded via ${path}`); break; }
      lastStatus = r.status;
      lastBody = await r.text().catch(() => '');
      log(`upload via ${path} → HTTP ${r.status}`);
    } catch (e: any) {
      log(`upload via ${path} network error ${e?.message || String(e)}`);
    }
  }
  if (!res) throw new Error(`${name}: upload HTTP ${lastStatus} ${lastBody.slice(0, 120)}`);
  const paths: string[] = await res.json();
  log(`uploaded ${name} paths=${JSON.stringify(paths)}`);
  const path = paths[0];
  if (!path) throw new Error(`${name}: server returned no path`);
  return {
    path,
    url: `${BASE}/file=${path}`,
    orig_name: name,
    meta: { _type: 'gradio.FileData' },
  };
}

function guessMime(uri: string, fallbackName: string): string {
  const n = (uri + fallbackName).toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

async function callPredict(data: unknown[]): Promise<any[]> {
  // Gradio 5 prefixes endpoints with /gradio_api, Gradio 4.x doesn't. Try both.
  const callPaths = [`/gradio_api/call/${ENDPOINT}`, `/call/${ENDPOINT}`];
  let initRes: Response | null = null;
  let usedPath = '';
  let lastStatus = 0;
  let lastBody = '';
  for (const path of callPaths) {
    try {
      const r = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ data }),
      });
      if (r.ok) { initRes = r; usedPath = path; log(`predict enqueued via ${path}`); break; }
      lastStatus = r.status;
      lastBody = await r.text().catch(() => '');
      log(`predict enqueue via ${path} → HTTP ${r.status}`);
    } catch (e: any) {
      log(`predict enqueue via ${path} network error ${e?.message || String(e)}`);
    }
  }
  if (!initRes) throw new Error(`Predict enqueue HTTP ${lastStatus} ${lastBody.slice(0, 160)}`);

  const { event_id } = await initRes.json();
  if (!event_id) throw new Error('Gradio did not return an event_id');

  // SSE stream — `await text()` resolves when the server ends the stream.
  // Free Spaces cold-start in 30–90s, so give the fetch plenty of time.
  const streamRes = await fetch(`${BASE}${usedPath}/${event_id}`, {
    headers: { ...authHeaders() },
  });
  if (!streamRes.ok) {
    throw new Error(`Predict stream HTTP ${streamRes.status}`);
  }
  const text = await streamRes.text();
  log(`predict stream len=${text.length}`);
  return parseSSEComplete(text);
}

function parseSSEComplete(text: string): any[] {
  // SSE frames look like:
  //   event: complete
  //   data: [ ...json... ]
  //
  //   event: error
  //   data: "message"
  const lines = text.split(/\r?\n/);
  let lastEvent = '';
  let errorData: any = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('event:')) {
      lastEvent = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      if (!payload) continue;
      if (lastEvent === 'complete') {
        try { return JSON.parse(payload); } catch { /* ignore */ }
      } else if (lastEvent === 'error') {
        errorData = payload;
      }
    }
  }
  if (errorData) throw new Error(`Try-on model error: ${errorData}`);
  throw new Error('Try-on model returned no result (stream had no `complete` event)');
}

export async function generateTryOn(personUri: unknown, garmentUri: unknown): Promise<string> {
  if (!TOKEN) {
    throw new Error('Missing EXPO_PUBLIC_HF_TOKEN — add it to .env.local and restart with `npx expo start -c`');
  }
  log(`generateTryOn person=${previewVal(personUri)} garment=${previewVal(garmentUri)}`);
  const [person, garment] = await Promise.all([
    uploadFile(personUri, 'person.jpg'),
    uploadFile(garmentUri, 'garment.jpg'),
  ]);
  log(`predict enqueue person=${person.path} garment=${garment.path}`);

  // OOTDiffusion /process_hd signature:
  //   0: vton_img     = FileData (person)
  //   1: garm_img     = FileData (garment)
  //   2: n_samples    = 1
  //   3: n_steps      = 20
  //   4: image_scale  = 2.0
  //   5: seed         = -1 (random)
  const result = await callPredict([person, garment, 1, 20, 2.0, -1]);

  // Extract the first image URL from whatever shape the Space returns.
  // Gradio Gallery: result[0] = [[FileData, caption], ...] or [{image: FileData, caption}, ...]
  // Single Image:   result[0] = FileData
  const url = extractImageUrl(result);
  if (!url) throw new Error(`Try-on model returned no image URL (got ${previewVal(result)})`);
  log(`success url=${url}`);
  return url;
}

function extractImageUrl(x: any): string | null {
  if (!x) return null;
  if (typeof x === 'string') return x.startsWith('http') ? x : null;
  if (Array.isArray(x)) {
    for (const item of x) {
      const found = extractImageUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof x === 'object') {
    // Prefer `path` — Gradio's `url` field is sometimes relative/malformed
    // (e.g. "/call/file=..." which isn't a real route). Constructing from
    // BASE + /file= + path always yields a reachable URL.
    if (typeof x.path === 'string') return `${BASE}/file=${x.path}`;
    if (typeof x.url === 'string' && x.url.startsWith('http')) return x.url;
    if (x.image) return extractImageUrl(x.image);
  }
  return null;
}
