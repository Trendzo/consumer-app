import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { C, T, SP, HELV, rf, subscribeTheme, useThemeVersion } from '../theme/brutal';

/**
 * Dependency-free renderer for the product long-description rich text.
 *
 * The backend stores it as sanitized HTML (see backend shared/sanitize/rich-text.ts)
 * with a fixed, safe tag allowlist: p, h2–h4, ul/ol/li, blockquote, table family,
 * span, strong/b, em/i, u, s, a. Because it is sanitized on write, this is a
 * forgiving display parser — NOT a security boundary — so it favours never
 * crashing over strict correctness. Unknown/edge markup degrades to text.
 *
 * We render to native <Text>/<View> (no WebView, no third-party HTML lib) because
 * the app runs React 19 / RN 0.81 new-arch, where react-native-render-html breaks.
 */

type ElNode = { type: 'el'; tag: string; href?: string; children: Node[] };
type TextNode = { type: 'text'; text: string };
type Node = ElNode | TextNode;

const VOID = new Set(['br']);

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&'); // ampersand LAST so we don't double-decode
}

/** Stack parser → shallow node tree. Balanced tags assumed (sanitizer guarantees it). */
function parse(html: string): Node[] {
  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];
  const root: ElNode = { type: 'el', tag: 'root', children: [] };
  const stack: ElNode[] = [root];
  for (const tk of tokens) {
    const top = stack[stack.length - 1]!;
    if (tk[0] === '<') {
      const m = tk.match(/^<\/?\s*([a-zA-Z0-9]+)/);
      if (!m) continue;
      const tag = m[1]!.toLowerCase();
      if (tk[1] === '/') {
        // Close: pop back to the nearest matching open tag (tolerates stray closes).
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i]!.tag === tag) {
            stack.length = i;
            break;
          }
        }
      } else if (tk.endsWith('/>') || VOID.has(tag)) {
        top.children.push({ type: 'el', tag, children: [] });
      } else {
        const hrefM = tag === 'a' ? tk.match(/href\s*=\s*"([^"]*)"/i) : null;
        const node: ElNode = { type: 'el', tag, children: [] };
        if (hrefM) node.href = hrefM[1];
        top.children.push(node);
        stack.push(node);
      }
    } else {
      // HTML collapses runs of whitespace (incl. the newlines the editor inserts).
      const text = decodeEntities(tk).replace(/\s+/g, ' ');
      if (text) top.children.push({ type: 'text', text });
    }
  }
  return root.children;
}

const openLink = (href?: string) => {
  if (href) Linking.openURL(href).catch(() => {});
};

/** Inline formatting → nested <Text>. Returns strings/elements usable inside a <Text>. */
function renderInline(nodes: Node[], keyBase: string): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyBase}.${i}`;
    if (n.type === 'text') return n.text;
    switch (n.tag) {
      case 'br':
        return '\n';
      case 'strong':
      case 'b':
        return <Text key={key} style={styles.bold}>{renderInline(n.children, key)}</Text>;
      case 'em':
      case 'i':
        return <Text key={key} style={styles.italic}>{renderInline(n.children, key)}</Text>;
      case 'u':
        return <Text key={key} style={styles.underline}>{renderInline(n.children, key)}</Text>;
      case 's':
        return <Text key={key} style={styles.strike}>{renderInline(n.children, key)}</Text>;
      case 'a':
        return (
          <Text key={key} style={styles.link} onPress={() => openLink(n.href)}>
            {renderInline(n.children, key)}
          </Text>
        );
      default:
        // span or unexpected inline wrapper — render its contents transparently.
        return <Text key={key}>{renderInline(n.children, key)}</Text>;
    }
  });
}

/** Collect <tr> descendants of a table (through thead/tbody), in order. */
function collectRows(node: ElNode): ElNode[] {
  const rows: ElNode[] = [];
  const walk = (n: ElNode) => {
    for (const c of n.children) {
      if (c.type !== 'el') continue;
      if (c.tag === 'tr') rows.push(c);
      else walk(c);
    }
  };
  walk(node);
  return rows;
}

function renderBlocks(nodes: Node[], keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  nodes.forEach((n, i) => {
    const key = `${keyBase}.${i}`;
    if (n.type === 'text') {
      const t = n.text.trim();
      if (t) out.push(<Text key={key} style={styles.p}>{t}</Text>);
      return;
    }
    switch (n.tag) {
      case 'p':
        out.push(<Text key={key} style={styles.p}>{renderInline(n.children, key)}</Text>);
        break;
      case 'h2':
      case 'h3':
      case 'h4':
        out.push(
          <Text
            key={key}
            style={[styles.h, n.tag === 'h2' ? styles.h2 : n.tag === 'h3' ? styles.h3 : styles.h4]}
          >
            {renderInline(n.children, key)}
          </Text>,
        );
        break;
      case 'blockquote':
        out.push(
          <View key={key} style={styles.quote}>
            {renderBlocks(n.children, key)}
          </View>,
        );
        break;
      case 'ul':
      case 'ol': {
        let idx = 0;
        n.children.forEach((li, j) => {
          if (li.type !== 'el' || li.tag !== 'li') return;
          idx += 1;
          out.push(
            <View key={`${key}.${j}`} style={styles.li}>
              <Text style={styles.marker}>{n.tag === 'ol' ? `${idx}.` : '•'}</Text>
              <Text style={[styles.p, styles.liText]}>{renderInline(li.children, `${key}.${j}`)}</Text>
            </View>,
          );
        });
        break;
      }
      case 'table':
        // Degrade to stacked rows of cell text — good enough for a spec table
        // without a real grid layout engine.
        collectRows(n).forEach((tr, r) => {
          const cells = tr.children.filter(
            (c): c is ElNode => c.type === 'el' && (c.tag === 'td' || c.tag === 'th'),
          );
          out.push(
            <View key={`${key}.r${r}`} style={styles.tr}>
              {cells.map((cell, ci) => (
                <Text
                  key={ci}
                  style={[styles.td, styles.p, cell.tag === 'th' && styles.bold]}
                >
                  {renderInline(cell.children, `${key}.r${r}.${ci}`)}
                </Text>
              ))}
            </View>,
          );
        });
        break;
      default:
        // Bare inline content at block level (e.g. loose <strong>text</strong>).
        out.push(<Text key={key} style={styles.p}>{renderInline([n], key)}</Text>);
    }
  });
  return out;
}

export function RichText({ html }: { html?: string | null }) {
  // Theme-reactive: `styles` below is rebuilt on every palette swap, and this
  // subscription re-renders mounted instances so they pick the rebuilt map up.
  const themeVersion = useThemeVersion();
  const tree = React.useMemo(() => (html ? parse(html) : []), [html]);
  const blocks = React.useMemo(() => renderBlocks(tree, 'r'), [tree, themeVersion]);
  if (!html || blocks.length === 0) return null;
  return <View>{blocks}</View>;
}

// Module-scope StyleSheet.create SNAPSHOTS C.*/T.* values at bundle load — the
// one pattern the reactive Proxy cannot reach. Rebuilt via subscribeTheme so a
// festival apply (and the cold-start hydrate, which runs before first mount)
// always lands. Do not copy the bare-const version of this pattern elsewhere.
const makeStyles = () => StyleSheet.create({
  p: { ...T.body, color: C.inkSoft, marginTop: SP.s, lineHeight: rf(21) },
  bold: { fontFamily: HELV, fontWeight: '700', color: C.ink },
  italic: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  strike: { textDecorationLine: 'line-through' },
  link: { color: C.ink, textDecorationLine: 'underline', fontWeight: '700' },
  h: { ...T.h3, color: C.ink, marginTop: SP.m },
  h2: { ...T.h2 },
  h3: {},
  h4: { ...T.caption, textTransform: 'uppercase' },
  quote: {
    marginTop: SP.m,
    paddingLeft: SP.m,
    borderLeftWidth: 3,
    borderColor: C.ink,
  },
  li: { flexDirection: 'row', gap: 8, marginTop: SP.s },
  marker: { ...T.body, color: C.ink },
  liText: { flex: 1, marginTop: 0 },
  tr: { flexDirection: 'row', gap: SP.m, marginTop: SP.s },
  td: { flex: 1, marginTop: 0 },
});
let styles = makeStyles();
subscribeTheme(() => { styles = makeStyles(); });
