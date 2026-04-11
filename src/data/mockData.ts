// Shared mock data for all 5 homepages.
// Each screen renders this differently per its design language.

// Unsplash CDN — for hero/lifestyle backgrounds
const u = (id: string, w = 600) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;
// pngimg.com — transparent product PNGs, free to hotlink
const png = (path: string) => `https://pngimg.com/uploads/${path}`;

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
export type Brand = { id: string; name: string; tint: string };
export type Reel = { id: string; user: string; title: string; colors: [string, string]; img: string };
export type Bundle = { id: string; title: string; price: number; pieces: number; colors: [string, string, string]; img: string };
export type CommunityPost = { id: string; user: string; likes: number; colors: [string, string]; img: string };
export type GameCard = { id: string; title: string; subtitle: string; cta: string; icon: string };
export type Occasion = { id: string; label: string; colors: [string, string]; img: string };

export const HERO_IMG = u('photo-1490481651871-ab68de25d43d', 900);
export const HERO_IMG_2 = u('photo-1469334031218-e382a71b716b', 900);
export const COUPON_IMG = u('photo-1483985988355-763728e1935b', 600);

export const PRODUCTS: Product[] = [
  { id: 'p1', brand: 'NORTH.', name: 'Oversized Wool Coat', price: 2499, original: 4999, rating: 4.8, colors: ['#f5e6d3', '#c9a87c'], img: png('coat/small/coat_PNG80.png'), category: 'Topwear', tag: 'NEW' },
  { id: 'p2', brand: 'KOH', name: 'Slim Fit Jeans', price: 1899, original: 2999, rating: 4.6, colors: ['#1a1a1a', '#3a3a3a'], img: png('jeans/small/jeans_PNG5779.png'), category: 'Bottomwear', tag: 'HOT' },
  { id: 'p3', brand: 'AZUKI', name: 'Cotton Tee', price: 1299, original: 1999, rating: 4.5, colors: ['#ff6b9d', '#feca57'], img: png('tshirt/small/tshirt_PNG5454.png'), category: 'Topwear' },
  { id: 'p4', brand: 'YORK', name: 'Court Sneaker', price: 3499, original: 5499, rating: 4.9, colors: ['#a8e6cf', '#dcedc1'], img: png('women_shoes/small/women_shoes_PNG7473.png'), category: 'Footwear', tag: 'TRENDING' },
  { id: 'p5', brand: 'GLOSSIER', name: 'Silk Slip Dress', price: 2799, original: 3999, rating: 4.7, colors: ['#ffafbd', '#ffc3a0'], img: png('dress/small/dress_PNG197.png'), category: 'Dresses' },
  { id: 'p6', brand: 'N99°', name: 'Leather Tote Bag', price: 3299, original: 4499, rating: 4.8, colors: ['#5d4037', '#8d6e63'], img: png('women_bag/small/women_bag_PNG6428.png'), category: 'Accessories', tag: 'NEW' },
  { id: 'p7', brand: 'RHODE', name: 'Bomber Jacket', price: 2199, original: 3299, rating: 4.6, colors: ['#fff5e1', '#ffe0b2'], img: png('jacket/small/jacket_PNG8059.png'), category: 'Topwear' },
  { id: 'p8', brand: 'NORTH.', name: 'Slim Wash Denim', price: 1599, original: 2499, rating: 4.4, colors: ['#c5cae9', '#9fa8da'], img: png('jeans/small/jeans_PNG5778.png'), category: 'Bottomwear', tag: 'HOT' },
];

export const CATEGORIES: Category[] = [
  { id: 'c1', label: 'Tops', icon: 'shirt-outline', tint: '#FFE66D', img: png('tshirt/small/tshirt_PNG5453.png') },
  { id: 'c2', label: 'Jeans', icon: 'cube-outline', tint: '#FF6B9D', img: png('jeans/small/jeans_PNG5779.png') },
  { id: 'c3', label: 'Shoes', icon: 'footsteps-outline', tint: '#4ECDC4', img: png('women_shoes/small/women_shoes_PNG7472.png') },
  { id: 'c4', label: 'Bags', icon: 'bag-handle-outline', tint: '#A78BFA', img: png('women_bag/small/women_bag_PNG6427.png') },
  { id: 'c5', label: 'Dresses', icon: 'diamond-outline', tint: '#F59E0B', img: png('dress/small/dress_PNG196.png') },
  { id: 'c6', label: 'Coats', icon: 'flower-outline', tint: '#EC4899', img: png('coat/small/coat_PNG79.png') },
  { id: 'c7', label: 'Jackets', icon: 'sparkles-outline', tint: '#10B981', img: png('jacket/small/jacket_PNG8058.png') },
  { id: 'c8', label: 'Tees', icon: 'fitness-outline', tint: '#3B82F6', img: png('tshirt/small/tshirt_PNG5452.png') },
];

export const BRANDS: Brand[] = [
  { id: 'b1', name: 'NORTH.', tint: '#1a1a1a' },
  { id: 'b2', name: 'KOH', tint: '#c9a87c' },
  { id: 'b3', name: 'AZUKI', tint: '#ff6b6b' },
  { id: 'b4', name: 'YORK', tint: '#2c3e50' },
  { id: 'b5', name: 'N99°', tint: '#8e44ad' },
  { id: 'b6', name: 'RHODE', tint: '#e8d5c4' },
];

export const REELS: Reel[] = [
  { id: 'r1', user: '@maya.styles', title: 'GRWM Spring Fit', colors: ['#ff6b9d', '#feca57'], img: u('photo-1483985988355-763728e1935b', 500) },
  { id: 'r2', user: '@kai.fits', title: 'Streetwear Haul', colors: ['#1a1a1a', '#5d4037'], img: u('photo-1487222477894-8943e31ef7b2', 500) },
  { id: 'r3', user: '@aria.x', title: 'Date Night Look', colors: ['#a8e6cf', '#dcedc1'], img: u('photo-1469334031218-e382a71b716b', 500) },
  { id: 'r4', user: '@neo.drips', title: 'Y2K is back', colors: ['#a78bfa', '#ff6b9d'], img: u('photo-1515886657613-9f3515b0c78f', 500) },
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
  { id: 'g6', title: 'Challenges', subtitle: '3 active tasks', cta: 'GO', icon: 'flame-outline' },
];

export const OCCASIONS: Occasion[] = [
  { id: 'o1', label: 'Casual', colors: ['#fff5e1', '#ffe0b2'], img: u('photo-1496747611176-843222e1e57c', 400) },
  { id: 'o2', label: 'Party', colors: ['#a78bfa', '#ff6b9d'], img: u('photo-1503342217505-b0a15ec3261c', 400) },
  { id: 'o3', label: 'Work', colors: ['#1a1a1a', '#5d4037'], img: u('photo-1591047139829-d91aecb6caea', 400) },
  { id: 'o4', label: 'Date', colors: ['#ff6b9d', '#feca57'], img: u('photo-1539109136881-3be0616acf4b', 400) },
  { id: 'o5', label: 'Wedding', colors: ['#f5e6d3', '#c9a87c'], img: u('photo-1469334031218-e382a71b716b', 400) },
];
