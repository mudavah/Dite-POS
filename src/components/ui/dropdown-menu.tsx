'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu as RadixDropdownMenu,
  DropdownMenuContent as RadixDropdownMenuContent,
  DropdownMenuItem as RadixDropdownMenuItem,
  DropdownMenuTrigger as RadixDropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';

type DropdownMenuProps = React.ComponentPropsWithoutRef<typeof RadixDropdownMenu>;
type DropdownMenuContentProps = React.ComponentPropsWithoutRef<typeof RadixDropdownMenuContent>;
type DropdownMenuItemProps = React.ComponentPropsWithoutRef<typeof RadixDropdownMenuItem>;
type DropdownMenuTriggerProps = React.ComponentPropsWithoutRef<typeof RadixDropdownMenuTrigger>;

const DropdownMenu = RadixDropdownMenu;
const DropdownMenuTrigger = RadixDropdownMenuTrigger;

const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof RadixDropdownMenuContent>, React.ComponentPropsWithoutRef<typeof RadixDropdownMenuContent>>(
  ({ className, align = 'start', sideOffset = 4, ...props }, ref) => (
    <RadixDropdownMenuContent ref={ref} align={align} sideOffset={sideOffset} className={cn('z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', className)} {...props} />
  )
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof RadixDropdownMenuItem>, React.ComponentPropsWithoutRef<typeof RadixDropdownMenuItem>>(
  ({ className, ...props }, ref) => (
    <RadixDropdownMenuItem ref={ref} className={cn('relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)} {...props} />
  )
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
