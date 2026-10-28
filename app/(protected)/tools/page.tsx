import React from 'react';
import Link from 'next/link';
import { TOOLS_REGISTRY } from '@/config/tools';
import {
  BarChart3,
  Sparkles,
  TrendingUp,
  ShieldAlert,
  Wand2,
  FileEdit,
  DollarSign,
  ZoomIn,
  ArrowRight,
  LayoutGrid,
  Scissors,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  BarChart3: <BarChart3 className="h-6 w-6" />,
  Sparkles: <Sparkles className="h-6 w-6" />,
  TrendingUp: <TrendingUp className="h-6 w-6" />,
  ShieldAlert: <ShieldAlert className="h-6 w-6" />,
  Wand2: <Wand2 className="h-6 w-6" />,
  FileEdit: <FileEdit className="h-6 w-6" />,
  DollarSign: <DollarSign className="h-6 w-6" />,
  ZoomIn: <ZoomIn className="h-6 w-6" />,
  Scissors: <Scissors className="h-6 w-6" />,
};

export default function ToolsOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 mb-1">
          <LayoutGrid className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            TOOLKIT REGISTRY
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          All Contributor Tools
        </h1>

        <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
          Explore specialized utilities built for microstock photographers, vector illustrators, and generative AI stock contributors.
        </p>
      </div>

      {/* Grid of Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TOOLS_REGISTRY.map((tool) => {
          const isLive = tool.status === 'live';
          const icon = ICON_MAP[tool.iconName] || <LayoutGrid className="h-6 w-6" />;

          const cardContent = (
            <div
              className={`glass-card rounded-2xl p-6 border transition-all h-full flex flex-col justify-between ${
                isLive
                  ? 'border-border/50 hover:border-primary/50 hover:shadow-xl hover:-translate-y-0.5'
                  : 'border-border/30 opacity-70 cursor-not-allowed bg-muted/20'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                    {icon}
                  </div>
                  {isLive ? (
                    <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      Live Tool
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted text-muted-foreground border border-border/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      Coming Soon
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">{tool.name}</h3>
                    {tool.badge && (
                      <span className="rounded-full bg-primary/10 text-primary px-2 py-0.2 text-[9px] font-bold">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </div>

              <div className="pt-6 flex items-center justify-between text-xs font-semibold">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {tool.category}
                </span>

                {isLive ? (
                  <span className="inline-flex items-center gap-1 text-primary group-hover:translate-x-1 transition-transform">
                    Launch Tool <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[11px]">In Development</span>
                )}
              </div>
            </div>
          );

          if (isLive) {
            return (
              <Link key={tool.id} href={tool.href} className="group block">
                {cardContent}
              </Link>
            );
          }

          return <div key={tool.id}>{cardContent}</div>;
        })}
      </div>
    </div>
  );
}
