export function getErrorCategory(error: Error & { digest?: string }): { title: string; description: string; retryable: boolean } {
  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch failed') || message.includes('timeout') || message.includes('econnreset')) {
    return {
      title: 'Network Error',
      description: 'Unable to reach the server. Please check your internet connection and try again.',
      retryable: true,
    };
  }

  if (message.includes('unauthorized') || message.includes('401') || message.includes('session expired')) {
    return {
      title: 'Session Expired',
      description: 'Your session has expired. Please log in again to continue.',
      retryable: false,
    };
  }

  if (message.includes('timeout') || message.includes('504')) {
    return {
      title: 'Request Timeout',
      description: 'The server took too long to respond. This may be due to high traffic or a slow connection. Please try again.',
      retryable: true,
    };
  }

  if (message.includes('duplicate') || message.includes('already processed')) {
    return {
      title: 'Duplicate Transaction',
      description: 'This sale may have already been processed. Please check your sales history or contact support.',
      retryable: false,
    };
  }

  if (message.includes('stock') || message.includes('insufficient') || message.includes('409')) {
    return {
      title: 'Stock Error',
      description: 'One or more items are out of stock. Please review your cart and try again.',
      retryable: false,
    };
  }

  return {
    title: 'Something went wrong',
    description: error.message || 'An unexpected error occurred. Please try again or contact support.',
    retryable: true,
  };
}
