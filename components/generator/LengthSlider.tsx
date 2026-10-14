'use client';

import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

interface LengthSliderProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  showWordCount?: boolean;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export function LengthSlider({
  label,
  icon,
  value,
  min,
  max,
  step = 1,
  unit,
  showWordCount = false,
  onChange,
  disabled = false,
}: LengthSliderProps) {
  const words = Math.round(value / 6);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
          <span className="text-primary">{icon}</span>
          <span>{label}</span>
        </div>

        <div className="text-right text-xs shrink-0 whitespace-nowrap">
          <span className="font-bold text-foreground">
            {value} {unit}
          </span>
          {showWordCount && (
            <span className="text-muted-foreground ml-1 text-[11px] font-normal">
              (~{words} words)
            </span>
          )}
        </div>
      </div>

      <SliderPrimitive.Root
        className="relative flex items-center select-none touch-none w-full h-4"
        value={[value]}
        max={max}
        min={min}
        step={step}
        disabled={disabled}
        onValueChange={(vals) => {
          if (vals[0] !== undefined) {
            onChange(vals[0]);
          }
        }}
      >
        <SliderPrimitive.Track className="bg-accent relative grow rounded-full h-1 overflow-hidden">
          <SliderPrimitive.Range className="absolute bg-primary/60 h-full rounded-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block w-3.5 h-3.5 bg-primary border-2 border-card rounded-full shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-transform active:scale-125 disabled:pointer-events-none"
          aria-label={label}
        />
      </SliderPrimitive.Root>
    </div>
  );
}
