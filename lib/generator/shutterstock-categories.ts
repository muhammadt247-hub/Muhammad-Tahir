// Shutterstock requires 1 category (a 2nd is optional) in its CSV "Categories" column.
// Names exactly as listed in Shutterstock's "Content Publishing Standards: Contextual Metadata" (Feb 2026).
// We pick them from the file's own title and keywords, so no extra AI request is needed.

export const SHUTTERSTOCK_CATEGORIES = [
  'Abstract',
  'Animals/Wildlife',
  'Arts',
  'Backgrounds/Textures',
  'Beauty/Fashion',
  'Buildings/Landmarks',
  'Business/Finance',
  'Celebrities',
  'Education',
  'Food and Drink',
  'Healthcare/Medical',
  'Holidays',
  'Industrial',
  'Interiors',
  'Miscellaneous',
  'Nature',
  'Objects',
  'Parks/Outdoor',
  'People',
  'Religion',
  'Science',
  'Signs/Symbols',
  'Sports/Recreation',
  'Technology',
  'Transportation',
  'Vintage',
] as const;

export type ShutterstockCategory = (typeof SHUTTERSTOCK_CATEGORIES)[number];

// Words that point to a category (whole words, singular; plurals are matched too).
// "Celebrities" is never chosen automatically (commercial content must not name real people).
const CUES: Partial<Record<ShutterstockCategory, string[]>> = {
  'Animals/Wildlife': ['animal', 'wildlife', 'dog', 'cat', 'puppy', 'kitten', 'bird', 'horse', 'cow', 'fish', 'insect', 'butterfly', 'lion', 'tiger', 'elephant', 'bear', 'deer', 'rabbit', 'pet', 'mammal', 'reptile', 'fox', 'wolf', 'monkey', 'owl', 'eagle', 'duck', 'sheep', 'goat', 'zoo'],
  'Food and Drink': ['food', 'drink', 'meal', 'fruit', 'vegetable', 'coffee', 'tea', 'cake', 'bread', 'dessert', 'pizza', 'burger', 'salad', 'breakfast', 'lunch', 'dinner', 'cooking', 'kitchen', 'juice', 'wine', 'beer', 'cocktail', 'snack', 'chocolate', 'cheese', 'meat', 'restaurant', 'baking', 'spice', 'soup', 'pasta', 'rice', 'cookie'],
  People: ['people', 'person', 'woman', 'man', 'girl', 'boy', 'child', 'kid', 'family', 'couple', 'portrait', 'face', 'hand', 'team', 'friend', 'senior', 'teenager', 'baby', 'adult', 'businessman', 'businesswoman', 'crowd'],
  'Business/Finance': ['business', 'finance', 'money', 'office', 'meeting', 'marketing', 'investment', 'bank', 'economy', 'corporate', 'startup', 'chart', 'graph', 'profit', 'coin', 'currency', 'trading', 'workplace', 'presentation', 'financial', 'sale'],
  'Buildings/Landmarks': ['building', 'architecture', 'landmark', 'house', 'skyscraper', 'tower', 'bridge', 'castle', 'church', 'temple', 'facade', 'city', 'skyline', 'street', 'monument', 'cityscape'],
  Interiors: ['interior', 'room', 'living room', 'bedroom', 'bathroom', 'furniture', 'sofa', 'home decor', 'apartment'],
  Nature: ['nature', 'landscape', 'forest', 'tree', 'flower', 'plant', 'mountain', 'sea', 'ocean', 'river', 'lake', 'sky', 'cloud', 'sunset', 'sunrise', 'beach', 'leaf', 'garden', 'grass', 'snow', 'waterfall', 'desert', 'field', 'rain'],
  'Parks/Outdoor': ['park', 'outdoor', 'camping', 'hiking', 'trail', 'playground', 'picnic', 'gardening'],
  'Backgrounds/Textures': ['background', 'texture', 'pattern', 'seamless', 'wallpaper', 'backdrop', 'surface', 'gradient', 'frame', 'border', 'copy space'],
  Abstract: ['abstract', 'fractal', 'geometric', 'shape', 'blur', 'bokeh', 'swirl', 'polygon'],
  Arts: ['art', 'painting', 'drawing', 'illustration', 'artwork', 'watercolor', 'sketch', 'artist', 'canvas', 'cartoon', 'clipart', 'doodle'],
  'Beauty/Fashion': ['beauty', 'fashion', 'makeup', 'cosmetic', 'hairstyle', 'clothing', 'dress', 'model', 'skincare', 'jewelry', 'perfume', 'shoe', 'style'],
  Education: ['education', 'school', 'student', 'book', 'learning', 'classroom', 'teacher', 'study', 'graduation', 'university', 'library', 'pencil'],
  'Healthcare/Medical': ['health', 'medical', 'medicine', 'doctor', 'nurse', 'hospital', 'pill', 'fitness', 'wellness', 'healthcare', 'clinic', 'dental', 'vaccine', 'therapy'],
  Holidays: ['holiday', 'christmas', 'easter', 'halloween', 'ramadan', 'eid', 'diwali', 'birthday', 'wedding', 'valentine', 'new year', 'celebration', 'festival', 'thanksgiving', 'hanukkah', 'vacation', 'party'],
  Industrial: ['industry', 'industrial', 'factory', 'construction', 'engineering', 'tool', 'machine', 'mining', 'warehouse', 'worker', 'manufacturing', 'electricity', 'oil', 'steel', 'welding'],
  Objects: ['object', 'product', 'bottle', 'box', 'cup', 'mug', 'bag', 'gift', 'toy', 'key', 'clock', 'lamp', 'chair', 'table', 'item', 'container', 'jar'],
  Religion: ['religion', 'religious', 'prayer', 'spiritual', 'mosque', 'cross', 'faith', 'bible', 'quran', 'buddha', 'worship'],
  Science: ['science', 'scientific', 'laboratory', 'chemistry', 'biology', 'physics', 'research', 'microscope', 'dna', 'molecule', 'planet', 'space', 'astronomy', 'experiment'],
  'Signs/Symbols': ['sign', 'symbol', 'icon', 'logo', 'arrow', 'flag', 'emblem', 'badge', 'label', 'emoji'],
  'Sports/Recreation': ['sport', 'football', 'soccer', 'basketball', 'tennis', 'running', 'yoga', 'gym', 'swimming', 'cycling', 'bike', 'surfing', 'fitness', 'exercise', 'golf', 'cricket', 'game', 'hobby'],
  Technology: ['technology', 'computer', 'laptop', 'phone', 'smartphone', 'digital', 'internet', 'network', 'data', 'robot', 'artificial intelligence', 'software', 'code', 'cyber', 'screen', 'electronic', 'tablet', 'virtual reality', 'futuristic'],
  Transportation: ['transport', 'transportation', 'car', 'truck', 'bus', 'train', 'airplane', 'plane', 'ship', 'boat', 'road', 'highway', 'vehicle', 'motorcycle', 'bicycle', 'traffic', 'airport', 'railway'],
  Vintage: ['vintage', 'retro', 'antique', 'old fashioned', 'sepia', 'nostalgic', 'classic'],
};

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

// Returns 1 or 2 category names. Keywords near the top count more (they are ordered by importance).
export function pickShutterstockCategories(title: string, keywords: string[]): ShutterstockCategory[] {
  const titleWords = words(title).join(' ');
  const kwList = keywords.map((k) => words(k).join(' '));
  const scores = new Map<ShutterstockCategory, number>();
  for (const [cat, cues] of Object.entries(CUES) as [ShutterstockCategory, string[]][]) {
    let s = 0;
    for (const cue of cues) {
      const re = new RegExp(`(^| )${cue}( |$)`);
      if (re.test(titleWords)) s += 3;
      kwList.forEach((kw, i) => {
        if (re.test(kw)) s += i < 10 ? 2 : 1;
      });
    }
    if (s > 0) scores.set(cat, s);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return ['Miscellaneous'];
  const out: ShutterstockCategory[] = [ranked[0][0]];
  // a second category only when it is clearly supported too
  if (ranked[1] && ranked[1][1] >= Math.max(3, ranked[0][1] * 0.5)) out.push(ranked[1][0]);
  return out;
}
