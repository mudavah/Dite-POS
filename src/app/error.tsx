'use client';

import * as React from 'react';
import { Button } from '@/components/ui';
import { getErrorCategory } from '@/lib/error-classifier';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const category = getErrorCategory(error);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
      <h2 className="text-xl font-semibold text-destructive">{category.title}</h2>
      <p className="text-muted-foreground text-center max-w-md">{category.description}</p>
      {category.retryable && (
        <Button onClick={reset}>Try again</Button>
      )}
      {!category.retryable && (
        <p className="text-sm text-muted-foreground">Please contact support if the problem persists.</p>
      )}
    </div>
  );
}
