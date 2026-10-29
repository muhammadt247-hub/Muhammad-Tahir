export type ToolTag = 'Generate' | 'Convert & Prepare' | 'Enhance';

export interface ToolRegistryItem {
  id: string;
  name: string;
  description: string;
  href: string;
  iconName: string;
  tag: ToolTag;
  badge: 'NEW' | 'LIVE' | string;
  status?: 'live' | 'soon';
  category?: string;
}

export const TOOLS_REGISTRY: ToolRegistryItem[] = [
  {
    id: 'generator',
    name: 'Metadata Generator',
    description: 'Generate high-ranking titles, descriptions, and keywords in batch for Adobe Stock, Shutterstock, and Freepik.',
    href: '/generator',
    iconName: 'Sparkles',
    tag: 'Generate',
    category: 'Generate',
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
    category: 'Enhance',
    badge: 'NEW',
    status: 'live',
  },
];
