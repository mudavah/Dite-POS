'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

function Tabs({ className, defaultValue, value, onValueChange, children }: { className?: string; defaultValue: string; value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;
  const handleChange = (newValue: string) => {
    if (!value) setInternalValue(newValue);
    onValueChange?.(newValue);
  };
  return (
    <div className={cn('', className)} data-value={currentValue}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === TabsList) {
          return React.cloneElement(child as React.ReactElement<{ value: string; onSelect: (v: string) => void; currentValue?: string }>, { onSelect: handleChange, currentValue });
        }
        if (React.isValidElement(child) && child.type === TabsContent) {
          return React.cloneElement(child as React.ReactElement<{ value: string }>, { value: currentValue });
        }
        return child;
      })}
    </div>
  );
}

function TabsList({ className, children, onSelect, currentValue }: { className?: string; children: React.ReactNode; onSelect?: (v: string) => void; currentValue?: string }) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)} role="tablist">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === TabsTrigger) {
          const childValue = (child as React.ReactElement<{ value: string }>).props.value;
          return React.cloneElement(child as React.ReactElement<{ isSelected: boolean; onSelect: (v: string) => void }>, { isSelected: currentValue === childValue, onSelect });
        }
        return child;
      })}
    </div>
  );
}

function TabsTrigger({ className, value, children, isSelected, onSelect, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string; isSelected?: boolean; onSelect?: (v: string) => void }) {
  return (
    <button className={cn('inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', isSelected && 'bg-background text-foreground shadow-sm', className)} onClick={() => onSelect?.(value)} role="tab" aria-selected={isSelected} {...props}>
      {children}
    </button>
  );
}

function TabsContent({ className, value, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  return <div className={cn('mt-2', className)} role="tabpanel" {...props}>{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
