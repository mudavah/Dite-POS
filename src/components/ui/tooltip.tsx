'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

function TooltipProvider({ children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} {...props}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

function Tooltip({ content, children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root> & { content?: React.ReactNode }) {
  return (
    <TooltipPrimitive.Root {...props}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      {content ? (
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="z-50 overflow-hidden rounded-md border bg-background px-3 py-1.5 text-sm text-foreground shadow-md animate-in fade-in-0 zoom-in-95"
            sideOffset={4}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-background" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      ) : (
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="z-50 overflow-hidden rounded-md border bg-background px-3 py-1.5 text-sm text-foreground shadow-md animate-in fade-in-0 zoom-in-95"
            sideOffset={4}
          >
            <TooltipPrimitive.Arrow className="fill-background" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      )}
    </TooltipPrimitive.Root>
  );
}

function TooltipContent({ className, side = 'top', sideOffset = 4, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side={side}
        sideOffset={sideOffset}
        className={cn(
          'z-50 overflow-hidden rounded-md border bg-background px-3 py-1.5 text-sm text-foreground shadow-md animate-in fade-in-0 zoom-in-95',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger asChild {...props} />;
}

export { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger };
