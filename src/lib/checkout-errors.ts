export class CheckoutError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode: number = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'CheckoutError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class CheckoutValidationError extends CheckoutError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CHECKOUT_VALIDATION_ERROR', message, 400, details);
  }
}

export class CheckoutAuthError extends CheckoutError {
  constructor(message: string = 'Unauthorized') {
    super('CHECKOUT_UNAUTHORIZED', message, 401);
  }
}

export class CheckoutStockError extends CheckoutError {
  constructor(productName: string, productId: string, available: number, requested: number) {
    super(
      'CHECKOUT_INSUFFICIENT_STOCK',
      `Insufficient stock for ${productName}`,
      409,
      { productId, productName, available, requested }
    );
  }
}

export class CheckoutBranchError extends CheckoutError {
  constructor(branchId: string) {
    super('CHECKOUT_BRANCH_NOT_FOUND', `Branch settings not found for branch ${branchId}`, 400, { branchId });
  }
}

export class CheckoutDuplicateError extends CheckoutError {
  constructor(saleId: string, receiptNo: string) {
    super('CHECKOUT_DUPLICATE_SALE', `Sale already processed: ${saleId}`, 409, { saleId, receiptNo });
  }
}

export class CheckoutTimeoutError extends CheckoutError {
  constructor(timeoutMs: number) {
    super('CHECKOUT_TIMEOUT', `Checkout request timed out after ${timeoutMs}ms`, 504, { timeoutMs });
  }
}

export class CheckoutSyncError extends CheckoutError {
  constructor(message: string, retryable: boolean = true) {
    super(
      'CHECKOUT_SYNC_FAILED',
      message,
      retryable ? 503 : 400,
      { retryable }
    );
  }
}

export class CheckoutProductNotFoundError extends CheckoutError {
  constructor(productName: string, productId: string) {
    super(
      'CHECKOUT_PRODUCT_NOT_FOUND',
      `Product not found: ${productName} (${productId})`,
      404,
      { productName, productId }
    );
  }
}

export function isCheckoutError(error: unknown): error is CheckoutError {
  return error instanceof CheckoutError;
}