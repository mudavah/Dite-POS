'use client';

import * as React from 'react';
import { Button } from '@/components/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen flex-col items-center justify-center gap-4">
          <h2 className="text-xl font-semibold">Application Error</h2>
          <p className="text-muted-foreground">{error.message}</p>
          <Button onClick={reset}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
