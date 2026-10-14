export interface ToolRegistryItem {
  id: string;
  name: string;
  description: string;
  href: string;
  iconName: string;
  status: 'live' | 'soon';
  category: 'Generator' | 'Research' | 'Optimization' | 'Analytics';
  badge?: string;
}

export const TOOLS_REGISTRY: ToolRegistryItem[] = [
  {
    id: 'generator',
    name: 'Metadata Generator',
    description: 'Generate high-ranking titles, descriptions, and keywords in batch for Adobe Stock, Shutterstock, and Freepik.',
    href: '/generator',
    iconName: 'Sparkles',
    status: 'live',
    category: 'Generator',
    badge: 'AI Powered',
  },
  {
    id: 'adobe-analytics',
    name: 'Adobe Analytics',
    description: 'Search, analyze, and reverse-engineer top-performing Adobe Stock assets and contributor portfolios.',
    href: '/adobe-analytics',
    iconName: 'BarChart3',
    status: 'live',
    category: 'Research',
    badge: 'Popular',
  },
  {
    id: 'keyword-research',
    name: 'Keyword Research and Trend Score',
    description: 'Uncover low-competition high-demand stock keywords with historical search volume curves.',
    href: '#',
    iconName: 'TrendingUp',
    status: 'soon',
    category: 'Research',
  },
  {
    id: 'rejection-checker',
    name: 'Rejection Reason Checker',
    description: 'Pre-screen images for compression artifacts, IP violations, trademark logos, and blurry subjects.',
    href: '#',
    iconName: 'ShieldAlert',
    status: 'soon',
    category: 'Optimization',
  },
  {
    id: 'earnings-tracker',
    name: 'Upload and Earnings Tracker',
    description: 'Consolidated dashboard for royalty earnings across Adobe Stock, Shutterstock, and Freepik.',
    href: '#',
    iconName: 'DollarSign',
    status: 'soon',
    category: 'Analytics',
  },
  {
    id: 'bulk-prompt',
    name: 'Bulk Image-to-Prompt',
    description: 'Deconstruct portfolios of images into exact Midjourney, Flux, and SDXL generative prompts.',
    href: '#',
    iconName: 'Wand2',
    status: 'soon',
    category: 'Generator',
  },
  {
    id: 'title-rewriter',
    name: 'Title Rewriter',
    description: 'Transform low-performing titles into click-worthy, algorithm-friendly stock marketplace titles.',
    href: '#',
    iconName: 'FileEdit',
    status: 'soon',
    category: 'Optimization',
  },
];
