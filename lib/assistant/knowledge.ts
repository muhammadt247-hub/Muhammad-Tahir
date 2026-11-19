// What the Orbinexa AI Assistant knows about the site, and the ONLY pages it may send people to.
// Keep this in sync with the real site. Do not add features, prices or policies that do not exist.

export type RouteId =
  | 'home'
  | 'generator'
  | 'tools'
  | 'background_remover'
  | 'image_converter'
  | 'vectorizer'
  | 'marketplace'
  | 'vendors'
  | 'my_orders'
  | 'vendor_page'
  | 'account'
  | 'signup'
  | 'login'
  | 'terms'
  | 'privacy';

// Real routes only (checked against the app folder). The assistant can never link anywhere else.
export const ROUTES: Record<RouteId, { path: string; label: string; needsLogin: boolean }> = {
  home: { path: '/', label: 'Home', needsLogin: false },
  generator: { path: '/generator', label: 'Open CSV Generator', needsLogin: true },
  tools: { path: '/tools', label: 'See all tools', needsLogin: true },
  background_remover: { path: '/tools/background-remover', label: 'Open Background Remover', needsLogin: true },
  image_converter: { path: '/tools/image-converter', label: 'Open Image Converter', needsLogin: true },
  vectorizer: { path: '/tools/vectorizer', label: 'Open Image to SVG', needsLogin: true },
  marketplace: { path: '/marketplace', label: 'Open Marketplace', needsLogin: true },
  vendors: { path: '/marketplace?tab=vendors', label: 'See all vendors', needsLogin: true },
  my_orders: { path: '/marketplace/orders', label: 'My orders', needsLogin: true },
  vendor_page: { path: '/marketplace/vendor', label: 'Become a vendor / My vendor page', needsLogin: true },
  account: { path: '/account', label: 'My account', needsLogin: true },
  signup: { path: '/signup', label: 'Create a free account', needsLogin: false },
  login: { path: '/login', label: 'Log in', needsLogin: false },
  terms: { path: '/terms', label: 'Terms of Service', needsLogin: false },
  privacy: { path: '/privacy', label: 'Privacy Policy', needsLogin: false },
};

export const ROUTE_IDS = Object.keys(ROUTES) as RouteId[];

// A marketplace search link (the shop opens with the search filled in and results cheapest first)
export function searchHref(q: string): string {
  return '/marketplace?q=' + encodeURIComponent(q.slice(0, 60));
}

// A link to one package in the shop (opens the package, highlighted, with its details)
export function packageHref(productId: string, listingId: string): string {
  return `/marketplace?product=${encodeURIComponent(productId)}&listing=${encodeURIComponent(listingId)}`;
}

// Facts about OrbinexaCSV, written from the real site (tools list, credits config, marketplace flow, terms).
export const SITE_KNOWLEDGE = `
ABOUT
OrbinexaCSV is a web toolkit for stock contributors (Adobe Stock, Shutterstock, Freepik). Main feature: an AI
CSV/metadata generator. It also has image tools and a marketplace for AI tools and digital subscriptions.

CSV GENERATOR (page: generator, login needed)
- Upload images (photos, also vectors and video frames). The AI writes a title, keywords and (for some sites)
  a description for each image, then you export a CSV file ready to upload.
- Choose the stock site first: Adobe Stock, Shutterstock, Freepik or General. The CSV columns and limits follow
  each site's official rules: Adobe titles up to 70 characters and up to 49 keywords (first 10 matter most);
  Shutterstock uses the title as "Description" and adds 1-2 categories, 7-50 keywords; Freepik titles of
  35-100 characters, 5-50 keywords (about 20 relevant ones are enough).
- Settings: title length, keyword count, keyword style (single words, two-word phrases or mixed), title prefix
  and suffix, banned title words, banned keywords, extra keywords, white/transparent background, language.
- Each result gets an SEO score with practical tips (title length, keyword stuffing, title/keyword match,
  site rules) and a compliance check for trademarks, brand names and blocked words.
- Prompt mode writes a text-to-image prompt from an image instead of metadata.
- Pricing: 1 credit per image, 1 credit to retitle. New accounts get free credits on sign up (amounts can
  change; the account page shows the balance). Users may add their own free Gemini or Groq API key under
  "API Keys" for faster batches; it is optional.
- Sign up: after creating an account, a confirmation email is sent. It can take up to 5 minutes; check Spam,
  Junk and Promotions, then press Resend. If it still does not arrive, press the green WhatsApp button on the
  sign-up or log-in screen and OrbinexaCSV will activate the account by hand.
- Reliability: images are processed in parallel; failed images can be retried one by one with Retry; Stop keeps
  finished results.
- Tips for better keywords: describe only what is visible, put the main subject, action and setting first,
  avoid repeating the same word, no brand names, no "AI generated" or file types in titles/keywords.
- AI images: Adobe needs the "Created using generative AI tools" box ticked after upload; Freepik needs the AI
  label; Shutterstock does not accept AI-generated images.

TOOLS (page: tools)
- Background Remover (page: background_remover): removes backgrounds in the browser. Normal mode is free;
  Smart (AI) mode costs 1 credit per image.
- Image Converter (page: image_converter): convert, resize and compress images in the browser.
- Image to SVG (page: vectorizer): turns raster images into SVG vectors.
- Coming later (not available yet): Upscale Studio, Prompt Engine, Seasonal Calendar, Adobe Stock Analytics.

MARKETPLACE (page: marketplace, login needed)
- Buy AI tools and subscriptions (for example ChatGPT, Canva, CapCut) from approved vendors. Prices are in
  Pakistani rupees (Rs). Search tools; every matching offer from every vendor is shown, cheapest first.
- Vendors tab (page: vendors): search vendors and sort by lowest or highest price, or by name.
- How buying works: open a package and press Order, enter your name and WhatsApp number (you do not pay yet),
  send the order on WhatsApp, we reply with payment details and you pay only OrbinexaCSV, never the vendor.
  After we confirm payment the vendor delivers to us, we check it, then it reaches you. You then have 6 hours to
  confirm or report a problem; problems are reviewed fairly. Track every step on My orders (page: my_orders).
- Your name and WhatsApp number are not shown to vendors. Vendors are approved by the OrbinexaCSV team.
- Offers: vendors can run discounts and post "Special offer" updates; live ones appear on the home page slider
  and in the marketplace.
- Sell on the marketplace: apply on the vendor page (page: vendor_page).

ACCOUNT AND HELP
- Account page (page: account): credits balance and account details. Invite friends to earn bonus credits
  (rules on the site).
- Support: email support@orbinexacsv.com, or the WhatsApp community link in the menu.
- Rules: Terms of Service (page: terms) and Privacy Policy (page: privacy).
`;
