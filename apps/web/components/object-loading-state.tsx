'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ObjectLoadingStateProps {
  type: string;
  className?: string;
}

export function ObjectLoadingState({ type, className }: ObjectLoadingStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-sky-50 to-blue-50 rounded-lg border-2 border-sky-200 border-dashed",
      className
    )}>
      <Loader2 className="h-8 w-8 text-sky-500 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-600">
        Generating {type}...
      </p>
      <div className="flex gap-1 mt-2">
        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}