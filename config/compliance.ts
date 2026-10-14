export interface BlocklistCategory {
  id: string;
  name: string;
  description: string;
  terms: string[];
}

export const BUILT_IN_BLOCKLIST: BlocklistCategory[] = [
  {
    id: 'brands',
    name: 'Brands & Companies',
    description: 'Commercial trademarks, corporate brands, and proprietary products',
    terms: [
      'apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods', 'ipod', 'ios',
      'nike', 'adidas', 'puma', 'reebok', 'under armour', 'new balance', 'asics',
      'coca-cola', 'coke', 'pepsi', 'pepsico', 'red bull', 'monster energy', 'gatorade',
      'google', 'android', 'youtube', 'pixel', 'chromebook', 'gmail',
      'facebook', 'instagram', 'whatsapp', 'meta', 'oculus', 'threads',
      'tiktok', 'bytedance', 'twitter', 'x corp', 'snapchat', 'linkedin', 'pinterest',
      'amazon', 'alexa', 'kindle', 'aws', 'prime video',
      'microsoft', 'windows', 'xbox', 'surface', 'office 365', 'cortana',
      'tesla', 'spacex', 'cybertruck', 'starlink',
      'disney', 'pixar', 'marvel', 'lucasfilm', 'national geographic',
      'starbucks', 'mcdonald\'s', 'mcdonalds', 'kfc', 'burger king', 'subway', 'domino\'s', 'pizza hut',
      'samsung', 'galaxy', 'sony', 'playstation', 'bravia', 'walkman',
      'nintendo', 'switch', 'game boy', 'wii',
      'lego', 'barbie', 'mattel', 'hasbro', 'nerf', 'hot wheels',
      'netflix', 'spotify', 'hulu', 'hbo', 'paramount',
      'gucci', 'louis vuitton', 'chanel', 'prada', 'hermes', 'dior', 'versace', 'rolex', 'cartier',
      'ferrari', 'lamborghini', 'porsche', 'mercedes', 'mercedes-benz', 'bmw', 'audi', 'toyota', 'honda', 'ford', 'chevrolet',
      'canon', 'nikon', 'adobe', 'photoshop', 'illustrator', 'lightroom',
      'zoom', 'uber', 'airbnb', 'ikea', 'zara', 'h&m'
    ]
  },
  {
    id: 'artists',
    name: 'Artists & Creators',
    description: 'Living or protected artist names and signature visual styles',
    terms: [
      'banksy', 'van gogh', 'picasso', 'pablo picasso', 'monet', 'claude monet',
      'yayoi kusama', 'kusama', 'andy warhol', 'warhol', 'salvador dali', 'dali',
      'rembrandt', 'da vinci', 'leonardo da vinci', 'michelangelo', 'frida kahlo',
      'georgia o\'keeffe', 'basquiat', 'jean-michel basquiat', 'keith haring', 'haring',
      'ansel adams', 'annie leibovitz', 'henri matisse', 'matisse', 'gustav klimt',
      'edvard munch', 'rene magritte', 'magritte', 'greg rutkowski', 'artgerm'
    ]
  },
  {
    id: 'characters',
    name: 'Fictional Characters & Franchises',
    description: 'Protected fictional characters, superhero franchises, and fictional universes',
    terms: [
      'mickey mouse', 'minnie mouse', 'donald duck', 'goofy',
      'spider-man', 'spiderman', 'iron man', 'captain america', 'thor', 'hulk', 'black widow', 'avengers',
      'batman', 'superman', 'wonder woman', 'joker', 'harley quinn', 'justice league',
      'pikachu', 'pokemon', 'pokémon', 'charizard', 'mewtwo',
      'barbie', 'ken', 'hello kitty', 'sanrio',
      'harry potter', 'voldemort', 'hogwarts', 'hermione', 'dumbledore',
      'star wars', 'darth vader', 'yoda', 'luke skywalker', 'mandalorian', 'baby yoda', 'grogu',
      'mario', 'super mario', 'luigi', 'bowser', 'zelda', 'link', 'sonic the hedgehog',
      'shrek', 'minions', 'transformers', 'optimus prime'
    ]
  },
  {
    id: 'people',
    name: 'Famous People & Celebrities',
    description: 'Real political figures, celebrities, and public individuals',
    terms: [
      'donald trump', 'trump', 'joe biden', 'biden', 'barack obama', 'obama',
      'elon musk', 'musk', 'jeff bezos', 'bill gates', 'steve jobs', 'mark zuckerberg',
      'taylor swift', 'beyonce', 'beyoncé', 'rihanna', 'drake', 'kanye west', 'eminem',
      'lionel messi', 'messi', 'cristiano ronaldo', 'ronaldo', 'lebron james', 'michael jordan',
      'tom cruise', 'leonardo dicaprio', 'brad pitt', 'keanu reeves', 'dwayne johnson'
    ]
  },
  {
    id: 'ai_phrases',
    name: 'AI-Label Phrases',
    description: 'Generative AI tags and generator names that Adobe automatically tracks or rejects',
    terms: [
      'generative ai', 'ai generated', 'ai-generated', 'created with ai', 'made with ai',
      'midjourney', 'dall-e', 'dalle', 'stable diffusion', 'firefly', 'adobe firefly',
      'runway gen', 'sora', 'deepfloyd', 'leonardo ai', 'imagen', 'flux.1', 'sdxl'
    ]
  },
  {
    id: 'camera_specs',
    name: 'Camera & Hardware Specs',
    description: 'Camera brands, models, and sensor references that should not be in commercial stock titles',
    terms: [
      'canon eos', 'canon 5d', 'nikon d', 'nikon z', 'sony alpha', 'sony a7',
      'gopro', 'hero 10', 'hero 11', 'hero 12', 'fujifilm x', 'fuji x-t',
      'hasselblad', 'leica m', 'leica q', 'dji mavic', 'dji phantom', 'red camera', 'arri alexa'
    ]
  }
];

// Ambiguous words that may be harmless natural words (fruit, animal, river, etc.)
// Flagged as amber "check" warnings instead of hard red errors
export const AMBIGUOUS_TERMS = new Set([
  'apple',      // fruit vs Apple Inc
  'amazon',     // rainforest/river vs Amazon.com
  'puma',       // wild cat vs sportswear
  'jaguar',     // animal vs luxury car
  'target',     // archery/goal vs retail store
  'shell',      // seashell vs oil company
  'canon',      // musical/religious canon vs camera company
  'subway',     // underground rail vs sandwich chain
  'dodge',      // verb to avoid vs car brand
  'polo',       // sport vs Ralph Lauren / clothing
  'ford',       // shallow river crossing vs Ford Motor
  'genesis',    // origin/Bible vs car brand
  'mini',       // adjective/short skirt vs Mini Cooper
  'ram'         // animal/computing vs truck brand
]);

// Common languages for Contributor Language setting
export const CONTRIBUTOR_LANGUAGES = [
  { code: 'en', label: 'English (Default)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'nl', label: 'Dutch (Nederlands)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'zh', label: 'Chinese (Simplified)' }
];
