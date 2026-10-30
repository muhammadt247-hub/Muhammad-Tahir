export type ToolTag = 'Generate' | 'Convert & Prepare' | 'Enhance' | 'Plan';

export interface ToolRegistryItem {
  id: string;
  name: string;
  description: string;
  href?: string;
  iconName: string;
  tag: ToolTag;
  badge: 'NEW' | 'LIVE' | 'UPCOMING';
  status: 'live' | 'soon';
}

export const TOOLS_REGISTRY: ToolRegistryItem[] = [
  // Live tools (first)
  {
    id: 'generator',
    name: 'Metadata Generator',
    description: 'Generate high-ranking titles, descriptions, and keywords in batch for Adobe Stock, Shutterstock, and Freepik.',
    href: '/generator',
    iconName: 'Sparkles',
    tag: 'Generate',
    badge: 'LIVE',
    status: 'live',
  },
  {
    id: 'background-remover',
    name: 'Background Remover',
    description: 'Remove image backgrounds free, right in your browser.',
    href: '/tools/background-remover',
    iconName: 'Scissors',
    tag: 'Enhance',
    badge: 'NEW',
    status: 'live',
  },

  // Upcoming tools (no link)
  {
    id: 'image-converter',
    name: 'Image Converter',
    description: 'Convert, resize and compress images in your browser.',
    href: '/tools/image-converter',
    iconName: 'FileImage',
    tag: 'Convert & Prepare',
    badge: 'NEW',
    status: 'live',
  },
  {
    id: 'upscale-studio',
    name: 'Upscale Studio',
    description: 'Make small images bigger and sharper with AI.',
    iconName: 'Maximize2',
    tag: 'Enhance',
    badge: 'UPCOMING',
    status: 'soon',
  },
  {
    id: 'svg-vectorizer',
    name: 'Image to SVG Vectorizer',
    description: 'Turn raster images into clean, scalable vectors.',
    iconName: 'Shapes',
    tag: 'Convert & Prepare',
    badge: 'UPCOMING',
    status: 'soon',
  },
  {
    id: 'prompt-engine',
    name: 'Prompt Engine',
    description: 'Turn an image or an idea into a good AI image prompt.',
    iconName: 'Wand2',
    tag: 'Generate',
    badge: 'UPCOMING',
    status: 'soon',
  },
  {
    id: 'seasonal-calendar',
    name: 'Seasonal Calendar',
    description: 'Plan your uploads around seasons, holidays and events.',
    iconName: 'CalendarDays',
    tag: 'Plan',
    badge: 'UPCOMING',
    status: 'soon',
  },
];
