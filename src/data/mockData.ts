// Shared mock data for all 5 homepages.
// Each screen renders this differently per its design language.

// Unsplash CDN — reliable, always-on. Used for hero / lifestyle imagery
// where a real photo is wanted.
const u = (id: string, w = 600) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;
// Real product PNGs (transparent backgrounds) from pngimg.com — direct CDN
// URLs that hotlink reliably. Format: `png('dress', 197)` →
// https://pngimg.com/uploads/dress/dress_PNG197.png
const png = (cat: string, n: number | string) => `https://pngimg.com/uploads/${cat}/${cat}_PNG${n}.png`;

export type Product = {
  id: string;
  brand: string;
  name: string;
  price: number;
  original: number;
  rating: number;
  colors: [string, string]; // fallback gradient colors
  img: string;
  category: string;
  tag?: string;
};

export type Category = { id: string; label: string; icon: string; tint: string; img: string };
export type Brand = { id: string; name: string; tint: string; logo: string; domain: string };
export type Reel = { id: string; user: string; title: string; colors: [string, string]; img: string };
export type Bundle = { id: string; title: string; price: number; pieces: number; colors: [string, string, string]; img: string };
export type CommunityPost = { id: string; user: string; likes: number; colors: [string, string]; img: string };
export type GameCard = { id: string; title: string; subtitle: string; cta: string; icon: string };
export type Occasion = { id: string; label: string; colors: [string, string]; img: string };

export const HERO_IMG = u('photo-1490481651871-ab68de25d43d', 900);
export const HERO_IMG_2 = u('photo-1469334031218-e382a71b716b', 900);
export const COUPON_IMG = u('photo-1483985988355-763728e1935b', 600);

export const PRODUCTS: Product[] = [
  { id: 'p1', brand: 'NORTH.',   name: 'Oversized Wool Coat', price: 2499, original: 4999, rating: 4.8, colors: ['#f5e6d3', '#c9a87c'], img: png('coat', 80),         category: 'Topwear',    tag: 'NEW' },
  { id: 'p2', brand: 'KOH',      name: 'Slim Fit Jeans',      price: 1899, original: 2999, rating: 4.6, colors: ['#1a1a1a', '#3a3a3a'], img: png('jeans', 5779),      category: 'Bottomwear', tag: 'HOT' },
  { id: 'p3', brand: 'AZUKI',    name: 'Cotton Tee',          price: 1299, original: 1999, rating: 4.5, colors: ['#ff6b9d', '#feca57'], img: png('tshirt', 5454),     category: 'Topwear' },
  { id: 'p4', brand: 'YORK',     name: 'Court Sneaker',       price: 3499, original: 5499, rating: 4.9, colors: ['#a8e6cf', '#dcedc1'], img: png('women_shoes', 7472), category: 'Footwear',  tag: 'TRENDING' },
  { id: 'p5', brand: 'GLOSSIER', name: 'Silk Slip Dress',     price: 2799, original: 3999, rating: 4.7, colors: ['#ffafbd', '#ffc3a0'], img: png('dress', 197),       category: 'Dresses' },
  { id: 'p6', brand: 'N99°',     name: 'Leather Tote Bag',    price: 3299, original: 4499, rating: 4.8, colors: ['#5d4037', '#8d6e63'], img: png('women_bag', 6428),  category: 'Accessories', tag: 'NEW' },
  { id: 'p7', brand: 'RHODE',    name: 'Bomber Jacket',       price: 2199, original: 3299, rating: 4.6, colors: ['#fff5e1', '#ffe0b2'], img: png('jacket', 8059),     category: 'Topwear' },
  { id: 'p8', brand: 'NORTH.',   name: 'Slim Wash Denim',     price: 1599, original: 2499, rating: 4.4, colors: ['#c5cae9', '#9fa8da'], img: png('jeans', 5778),      category: 'Bottomwear', tag: 'HOT' },
];

export const CATEGORIES: Category[] = [
  { id: 'c1', label: 'Tops',    icon: 'shirt-outline',     tint: '#FFE66D', img: png('tshirt', 5453) },
  { id: 'c2', label: 'Jeans',   icon: 'cube-outline',      tint: '#FF6B9D', img: png('jeans', 5779) },
  { id: 'c3', label: 'Shoes',   icon: 'footsteps-outline', tint: '#4ECDC4', img: png('women_shoes', 7472) },
  { id: 'c4', label: 'Bags',    icon: 'bag-handle-outline', tint: '#A78BFA', img: png('women_bag', 6427) },
  { id: 'c5', label: 'Dresses', icon: 'diamond-outline',   tint: '#F59E0B', img: png('dress', 196) },
  { id: 'c6', label: 'Coats',   icon: 'flower-outline',    tint: '#EC4899', img: png('coat', 79) },
  { id: 'c7', label: 'Jackets', icon: 'sparkles-outline',  tint: '#10B981', img: png('jacket', 8058) },
  { id: 'c8', label: 'Tees',    icon: 'fitness-outline',   tint: '#3B82F6', img: png('tshirt', 5452) },
];

// Wikimedia Commons transparent PNG logos (rendered from official SVG files)
export const BRANDS: Brand[] = [
  { id: 'b1', name: 'NIKE', tint: '#111', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/500px-Logo_NIKE.svg.png', domain: 'nike.com' },
  { id: 'b2', name: 'ADIDAS', tint: '#000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Adidas_Logo.svg/500px-Adidas_Logo.svg.png', domain: 'adidas.com' },
  { id: 'b3', name: 'ZARA', tint: '#1a1a1a', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Zara_Logo.svg/500px-Zara_Logo.svg.png', domain: 'zara.com' },
  { id: 'b4', name: 'H&M', tint: '#e50010', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/H%26M-Logo.svg/500px-H%26M-Logo.svg.png', domain: 'hm.com' },
  { id: 'b5', name: 'UNIQLO', tint: '#ff0000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UNIQLO_logo.svg/500px-UNIQLO_logo.svg.png', domain: 'uniqlo.com' },
  { id: 'b6', name: 'PUMA', tint: '#000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Puma-logo-%28text%29.svg/500px-Puma-logo-%28text%29.svg.png', domain: 'puma.com' },
  { id: 'b7', name: 'GUCCI', tint: '#1a1a1a', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/1960s_Gucci_Logo.svg/500px-1960s_Gucci_Logo.svg.png', domain: 'gucci.com' },
  { id: 'b8', name: 'LEVI\'S', tint: '#c41230', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Levi%27s_logo.svg/500px-Levi%27s_logo.svg.png', domain: 'levi.com' },
  { id: 'b9', name: 'CALVIN KLEIN', tint: '#000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Calvin_klein_logo.svg/500px-Calvin_klein_logo.svg.png', domain: 'calvinklein.com' },
  { id: 'b10', name: 'TOMMY', tint: '#002d72', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Tommy_Hilfiger_logo.svg/500px-Tommy_Hilfiger_logo.svg.png', domain: 'tommy.com' },
  { id: 'b11', name: 'RALPH LAUREN', tint: '#1a1a1a', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Ralph_Lauren_logo.svg/500px-Ralph_Lauren_logo.svg.png', domain: 'ralphlauren.com' },
  { id: 'b12', name: 'NEW BALANCE', tint: '#cf0a2c', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/New_Balance_logo.svg/500px-New_Balance_logo.svg.png', domain: 'newbalance.com' },
  { id: 'b13', name: 'FILA', tint: '#c81533', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Fila_logo.svg/500px-Fila_logo.svg.png', domain: 'fila.com' },
  { id: 'b14', name: 'REEBOK', tint: '#e41837', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Reebok_2019_logo.svg/500px-Reebok_2019_logo.svg.png', domain: 'reebok.com' },
  { id: 'b15', name: 'CONVERSE', tint: '#000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Converse_logo.svg/500px-Converse_logo.svg.png', domain: 'converse.com' },
  { id: 'b16', name: 'VANS', tint: '#c3002f', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Vans-logo.svg/500px-Vans-logo.svg.png', domain: 'vans.com' },
  { id: 'b17', name: 'UNDER ARMOUR', tint: '#000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Under_armour_logo.svg/500px-Under_armour_logo.svg.png', domain: 'underarmour.com' },
  { id: 'b18', name: 'DIESEL', tint: '#000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Diesel_logo.svg/500px-Diesel_logo.svg.png', domain: 'diesel.com' },
  { id: 'b19', name: 'HUGO BOSS', tint: '#000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Hugo-Boss-Logo.svg/500px-Hugo-Boss-Logo.svg.png', domain: 'hugoboss.com' },
  { id: 'b20', name: 'VERSACE', tint: '#000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Versace_old_logo.svg/500px-Versace_old_logo.svg.png', domain: 'versace.com' },
  { id: 'b21', name: 'PRADA', tint: '#000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Prada-Logo.svg/500px-Prada-Logo.svg.png', domain: 'prada.com' },
  { id: 'b22', name: 'CHAMPION', tint: '#002d72', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Champion_USA_logo.svg/500px-Champion_USA_logo.svg.png', domain: 'champion.com' },
  { id: 'b23', name: 'BURBERRY', tint: '#1a1a1a', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Burberry_Logo.svg/500px-Burberry_Logo.svg.png', domain: 'burberry.com' },
  { id: 'b24', name: 'NORTH FACE', tint: '#000', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/TheNorthFace_logo.svg/500px-TheNorthFace_logo.svg.png', domain: 'thenorthface.com' },
];

export const REELS: Reel[] = [
  { id: 'r1', user: '@style.studio', title: 'Fall Layering Tips', colors: ['#c0392b', '#e67e22'], img: u('photo-1558618666-fcd25c85f82e', 500) },
  { id: 'r2', user: '@outfit.daily', title: 'Minimal Wardrobe Essentials', colors: ['#ecf0f1', '#bdc3c7'], img: u('photo-1591047139829-d91aecb6caea', 500) },
  { id: 'r3', user: '@runway.rep', title: 'Designer Dupe Finds', colors: ['#8e44ad', '#3498db'], img: u('photo-1558171813-4c088753af8f', 500) },
  { id: 'r4', user: '@thrift.queen', title: 'Thrift Flip Haul', colors: ['#27ae60', '#f1c40f'], img: u('photo-1445205170230-053b83016050', 500) },
  { id: 'r5', user: '@coat.check', title: 'Outerwear Season', colors: ['#2c3e50', '#7f8c8d'], img: u('photo-1539109136881-3be0616acf4b', 500) },
  { id: 'r6', user: '@denim.diaries', title: 'Denim On Denim', colors: ['#2980b9', '#1abc9c'], img: u('photo-1542272604-787c3835535d', 500) },
];

export const BUNDLES: Bundle[] = [
  { id: 'bn1', title: 'Sunday Brunch', price: 4999, pieces: 4, colors: ['#fff5e1', '#ffe0b2', '#c9a87c'], img: u('photo-1496747611176-843222e1e57c', 500) },
  { id: 'bn2', title: 'Office Power', price: 6499, pieces: 3, colors: ['#1a1a1a', '#3a3a3a', '#5d4037'], img: u('photo-1591047139829-d91aecb6caea', 500) },
  { id: 'bn3', title: 'Date Night', price: 5299, pieces: 4, colors: ['#ff6b9d', '#a78bfa', '#feca57'], img: u('photo-1539109136881-3be0616acf4b', 500) },
];

export const COMMUNITY: CommunityPost[] = [
  { id: 'cp1', user: '@zara.fits', likes: 1240, colors: ['#ff6b9d', '#feca57'], img: u('photo-1485518882345-15568b007407', 500) },
  { id: 'cp2', user: '@ren.style', likes: 892, colors: ['#a8e6cf', '#dcedc1'], img: u('photo-1503342217505-b0a15ec3261c', 500) },
  { id: 'cp3', user: '@mia.x', likes: 2103, colors: ['#a78bfa', '#ff6b9d'], img: u('photo-1581044777550-4cfa60707c03', 500) },
  { id: 'cp4', user: '@kio.drip', likes: 654, colors: ['#1a1a1a', '#5d4037'], img: u('photo-1490481651871-ab68de25d43d', 500) },
];

export const GAMES: GameCard[] = [
  { id: 'g1', title: 'Daily Reward', subtitle: 'Day 7 streak 🔥', cta: 'CLAIM', icon: 'gift-outline' },
  { id: 'g2', title: 'Spin & Win', subtitle: 'Up to 80% OFF', cta: 'SPIN', icon: 'sync-outline' },
  { id: 'g3', title: 'Lucky Draw', subtitle: 'Win iPhone 17', cta: 'ENTER', icon: 'trophy-outline' },
  { id: 'g4', title: 'Style Quiz', subtitle: 'Find your vibe', cta: 'START', icon: 'color-palette-outline' },
  { id: 'g5', title: 'Invite Friends', subtitle: 'Earn ₹200', cta: 'SHARE', icon: 'people-outline' },
  { id: 'g6', title: 'Quests', subtitle: '3 active tasks', cta: 'GO', icon: 'flame-outline' },
];

export const OCCASIONS: Occasion[] = [
  { id: 'o1', label: 'Casual', colors: ['#fff5e1', '#ffe0b2'], img: u('photo-1496747611176-843222e1e57c', 400) },
  { id: 'o2', label: 'Party', colors: ['#a78bfa', '#ff6b9d'], img: u('photo-1503342217505-b0a15ec3261c', 400) },
  { id: 'o3', label: 'Work', colors: ['#1a1a1a', '#5d4037'], img: u('photo-1591047139829-d91aecb6caea', 400) },
  { id: 'o4', label: 'Date', colors: ['#ff6b9d', '#feca57'], img: u('photo-1539109136881-3be0616acf4b', 400) },
  { id: 'o5', label: 'Wedding', colors: ['#f5e6d3', '#c9a87c'], img: u('photo-1469334031218-e382a71b716b', 400) },
];

// ─── GENDER-SPECIFIC DATA ──────────────────────────────────
// Used by HomeScreen to swap content when gender toggle is changed

export const HER_HERO = u('photo-1483985988355-763728e1935b', 900);
export const HIM_HERO = u('photo-1490481651871-ab68de25d43d', 900);

// HER products — feminine pieces: dresses, heels, handbags, lipstick…
export const HER_PRODUCTS: Product[] = [
  { id: 'hp1', brand: 'GLOSSIER', name: 'Silk Slip Dress',    price: 2799, original: 3999, rating: 4.7, img: png('dress', 197),         category: 'Dresses', tag: 'NEW',      colors: ['#ffafbd', '#ffc3a0'] },
  { id: 'hp2', brand: 'AZUKI',    name: 'Floral Maxi',        price: 3299, original: 4499, rating: 4.8, img: png('dress', 196),         category: 'Dresses', tag: 'HOT',      colors: ['#ff6b9d', '#feca57'] },
  { id: 'hp3', brand: 'N99°',     name: 'Designer Tote',      price: 4299, original: 5499, rating: 4.9, img: png('women_bag', 6428),    category: 'Bags',    tag: 'TRENDING', colors: ['#5d4037', '#8d6e63'] },
  { id: 'hp4', brand: 'NORTH.',   name: 'Block Heels',        price: 3199, original: 4299, rating: 4.6, img: png('women_shoes', 7473),  category: 'Shoes',   colors: ['#a8e6cf', '#dcedc1'] },
  { id: 'hp5', brand: 'KOH',      name: 'Elegant Mini Dress', price: 1799, original: 2499, rating: 4.5, img: png('dress', 194),         category: 'Dresses', tag: 'NEW',      colors: ['#f5e6d3', '#c9a87c'] },
  { id: 'hp6', brand: 'RHODE',    name: 'Crop Top',           price: 1599, original: 2199, rating: 4.7, img: png('tshirt', 5453),       category: 'Tops',    colors: ['#ff6b9d', '#feca57'] },
  { id: 'hp7', brand: 'YORK',     name: 'Designer Lipstick',  price: 899,  original: 1499, rating: 4.8, img: png('lipstick', 76278),    category: 'Beauty',  tag: 'NEW',      colors: ['#fff', '#f3f3f3'] },
  { id: 'hp8', brand: 'GLOSSIER', name: 'Statement Watch',    price: 1199, original: 1799, rating: 4.7, img: png('watches', 101456),    category: 'Jewelry', colors: ['#a78bfa', '#ff6b9d'] },
];

// HIM products — masculine pieces: jeans, sneakers, blazers, watches, tees…
export const HIM_PRODUCTS: Product[] = [
  { id: 'mp1', brand: 'NORTH.',   name: 'Wool Coat',        price: 2499, original: 4999, rating: 4.8, img: png('coat', 80),          category: 'Coats',    tag: 'NEW',      colors: ['#5d4037', '#8d6e63'] },
  { id: 'mp2', brand: 'KOH',      name: 'Slim Denim',       price: 1899, original: 2999, rating: 4.6, img: png('jeans', 5779),       category: 'Jeans',    tag: 'HOT',      colors: ['#1a1a1a', '#3a3a3a'] },
  { id: 'mp3', brand: 'YORK',     name: 'Court Sneaker',    price: 3499, original: 5499, rating: 4.9, img: png('women_shoes', 7472), category: 'Sneakers', tag: 'TRENDING', colors: ['#fff', '#f3f3f3'] },
  { id: 'mp4', brand: 'RHODE',    name: 'Bomber Jacket',    price: 2199, original: 3299, rating: 4.6, img: png('jacket', 8059),      category: 'Jackets',  colors: ['#111', '#444'] },
  { id: 'mp5', brand: 'AZUKI',    name: 'Graphic Tee',      price: 1299, original: 1999, rating: 4.5, img: png('tshirt', 5454),      category: 'Tees',     colors: ['#000', '#222'] },
  { id: 'mp6', brand: 'N99°',     name: 'Polo Shirt',       price: 1599, original: 2299, rating: 4.7, img: png('tshirt', 5453),      category: 'Shirts',   tag: 'NEW',      colors: ['#2c3e50', '#34495e'] },
  { id: 'mp7', brand: 'NORTH.',   name: 'Wrist Watch',      price: 1899, original: 2799, rating: 4.6, img: png('watches', 101457),   category: 'Watches',  colors: ['#5d4037', '#3e2723'] },
  { id: 'mp8', brand: 'KOH',      name: 'Aviator Shades',   price: 1599, original: 2499, rating: 4.4, img: png('sunglasses', 155),   category: 'Eyewear',  tag: 'NEW',      colors: ['#1a1a1a', '#3a3a3a'] },
];

// HER categories — distinctly feminine, real product PNGs
export const HER_CATEGORIES: Category[] = [
  { id: 'her-c1', label: 'Dresses', icon: 'gift',         tint: '#ffafbd', img: png('dress', 197) },
  { id: 'her-c2', label: 'Mini',    icon: 'scissors',     tint: '#f5e6d3', img: png('dress', 194) },
  { id: 'her-c3', label: 'Heels',   icon: 'arrow-up',     tint: '#a8e6cf', img: png('women_shoes', 7473) },
  { id: 'her-c4', label: 'Bags',    icon: 'briefcase',    tint: '#5d4037', img: png('women_bag', 6428) },
  { id: 'her-c5', label: 'Beauty',  icon: 'shopping-bag', tint: '#ff6b9d', img: png('lipstick', 76278) },
  { id: 'her-c6', label: 'Coats',   icon: 'cloud',        tint: '#fff',    img: png('coat', 79) },
  { id: 'her-c7', label: 'Tops',    icon: 'shield',       tint: '#a78bfa', img: png('tshirt', 5452) },
  { id: 'her-c8', label: 'Maxi',    icon: 'feather',      tint: '#feca57', img: png('dress', 196) },
];

// HIM categories — distinctly masculine, real product PNGs
export const HIM_CATEGORIES: Category[] = [
  { id: 'him-c1', label: 'Tees',     icon: 'square',   tint: '#000',    img: png('tshirt', 5454) },
  { id: 'him-c2', label: 'Jeans',    icon: 'minus',    tint: '#1a1a1a', img: png('jeans', 5779) },
  { id: 'him-c3', label: 'Jackets',  icon: 'shield',   tint: '#111',    img: png('jacket', 8059) },
  { id: 'him-c4', label: 'Sneakers', icon: 'play',     tint: '#fff',    img: png('women_shoes', 7472) },
  { id: 'him-c5', label: 'Watches',  icon: 'clock',    tint: '#2c3e50', img: png('watches', 101457) },
  { id: 'him-c6', label: 'Polos',    icon: 'square',   tint: '#000',    img: png('tshirt', 5453) },
  { id: 'him-c7', label: 'Coats',    icon: 'cloud',    tint: '#5d4037', img: png('coat', 80) },
  { id: 'him-c8', label: 'Shades',   icon: 'umbrella', tint: '#3e2723', img: png('sunglasses', 155) },
];

export const HER_BUNDLES: Bundle[] = [
  { id: 'hb1', title: 'Brunch Goddess', price: 4999, pieces: 4, colors: ['#ffafbd', '#ffc3a0', '#feca57'], img: u('photo-1483985988355-763728e1935b', 500) },
  { id: 'hb2', title: 'Date Night Glam', price: 6499, pieces: 3, colors: ['#ff6b9d', '#a78bfa', '#feca57'], img: u('photo-1539109136881-3be0616acf4b', 500) },
  { id: 'hb3', title: 'Office Chic', price: 5299, pieces: 4, colors: ['#fff', '#f3f3f3', '#ffafbd'], img: u('photo-1496747611176-843222e1e57c', 500) },
];

export const HIM_BUNDLES: Bundle[] = [
  { id: 'mb1', title: 'Street Uniform', price: 4999, pieces: 4, colors: ['#000', '#222', '#333'], img: u('photo-1490481651871-ab68de25d43d', 500) },
  { id: 'mb2', title: 'Office Power', price: 6499, pieces: 3, colors: ['#1a1a1a', '#3a3a3a', '#5d4037'], img: u('photo-1591047139829-d91aecb6caea', 500) },
  { id: 'mb3', title: 'Weekend Drip', price: 5299, pieces: 4, colors: ['#222', '#5d4037', '#888'], img: u('photo-1507003211169-0a1dd7228f2d', 500) },
];

export const HER_OCCASIONS: Occasion[] = [
  { id: 'ho1', label: 'Brunch', colors: ['#fff5e1', '#ffe0b2'], img: u('photo-1496747611176-843222e1e57c', 400) },
  { id: 'ho2', label: 'Date', colors: ['#ff6b9d', '#feca57'], img: u('photo-1539109136881-3be0616acf4b', 400) },
  { id: 'ho3', label: 'Beach', colors: ['#a8e6cf', '#dcedc1'], img: u('photo-1583496661160-fb5886a0aaaa', 400) },
  { id: 'ho4', label: 'Wedding', colors: ['#f5e6d3', '#c9a87c'], img: u('photo-1469334031218-e382a71b716b', 400) },
  { id: 'ho5', label: 'Party', colors: ['#a78bfa', '#ff6b9d'], img: u('photo-1503342217505-b0a15ec3261c', 400) },
];

export const HIM_OCCASIONS: Occasion[] = [
  { id: 'mo1', label: 'Office', colors: ['#1a1a1a', '#5d4037'], img: u('photo-1591047139829-d91aecb6caea', 400) },
  { id: 'mo2', label: 'Streetwear', colors: ['#000', '#333'], img: u('photo-1490481651871-ab68de25d43d', 400) },
  { id: 'mo3', label: 'Gym', colors: ['#222', '#666'], img: u('photo-1517836357463-d25dfeac3438', 400) },
  { id: 'mo4', label: 'Formal', colors: ['#1a1a1a', '#3a3a3a'], img: u('photo-1507003211169-0a1dd7228f2d', 400) },
  { id: 'mo5', label: 'Travel', colors: ['#5d4037', '#8d6e63'], img: u('photo-1525507119028-ed4c629a60a3', 400) },
];
