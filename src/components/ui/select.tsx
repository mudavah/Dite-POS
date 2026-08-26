'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Select as RadixSelect,
  SelectContent as RadixSelectContent,
  SelectItem as RadixSelectItem,
  SelectTrigger as RadixSelectTrigger,
  SelectValue as RadixSelectValue,
  SelectViewport,
  SelectItemIndicator,
  SelectIcon,
} from '@radix-ui/react-select';

type SelectProps = React.ComponentPropsWithoutRef<typeof RadixSelect>;
type SelectContentProps = React.ComponentPropsWithoutRef<typeof RadixSelectContent>;
type SelectItemProps = React.ComponentPropsWithoutRef<typeof RadixSelectItem>;
type SelectTriggerProps = React.ComponentPropsWithoutRef<typeof RadixSelectTrigger>;
type SelectValueProps = React.ComponentPropsWithoutRef<typeof RadixSelectValue>;

const Select = RadixSelect;
const SelectContent = React.forwardRef<React.ElementRef<typeof RadixSelectContent>, React.ComponentPropsWithoutRef<typeof RadixSelectContent>>(
  ({ className, children, ...props }, ref) => (
    <RadixSelectContent ref={ref} className={cn('relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', className)} {...props}>
      <SelectViewport className="p-1">{children}</SelectViewport>
    </RadixSelectContent>
  )
);
SelectContent.displayName = 'SelectContent';

const SelectItem = React.forwardRef<React.ElementRef<typeof RadixSelectItem>, React.ComponentPropsWithoutRef<typeof RadixSelectItem>>(
  ({ className, children, ...props }, ref) => (
    <RadixSelectItem ref={ref} className={cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)} {...props}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectItemIndicator />
      </span>
      {children}
    </RadixSelectItem>
  )
);
SelectItem.displayName = 'SelectItem';

const SelectTrigger = React.forwardRef<React.ElementRef<typeof RadixSelectTrigger>, React.ComponentPropsWithoutRef<typeof RadixSelectTrigger>>(
  ({ className, children, ...props }, ref) => (
    <RadixSelectTrigger ref={ref} className={cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props}>
      {children}
      <SelectIcon />
    </RadixSelectTrigger>
  )
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = React.forwardRef<React.ElementRef<typeof RadixSelectValue>, React.ComponentPropsWithoutRef<typeof RadixSelectValue>>(
  ({ className, ...props }, ref) => (
    <RadixSelectValue ref={ref} className={cn(className)} {...props} />
  )
);
SelectValue.displayName = 'SelectValue';

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };