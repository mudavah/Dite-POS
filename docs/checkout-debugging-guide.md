# Checkout Failure Debugging Guide

## Overview

This guide provides a systematic approach to diagnosing and resolving checkout failures in the Dite POS application. The checkout flow spans client-side UI, API routes, server-side actions, database transactions, and offline sync mechanisms.

## Checkout Flow Summary

```
CheckoutModal (client)
  -> POST /api/pos/checkout
    -> auth() middleware
    -> saleSchema.safeParse(body)
    -> createSale(data, branchId, cashierId)
      -> prisma.$transaction(...):
        1. Create sale record + sale items
        2. Decrement inventory (with stock check)
        3. Create stock movements
        4. Increment receiptNextNum in branchSettings
        5. Create receipt record
      -> return { sale, receiptNo }
    -> return { id, receiptNo, totalAmount, changeAmount }
  -> Display success / redirect to /checkout/complete
```

Offline path:
```
CheckoutModal (client, offline)
  -> usePosStore.completeOfflineSale(payload)
    -> Dexie: save to salesQueue + saleItems + receipts
  -> syncEngine.processQueue() on reconnect
    -> POST /api/sync
      -> createSale(parsed payload)
```

---

## Step 1: Identify the Failure Category

### 1A. Payment Gateway / Payment Method Errors

The application does NOT use an external payment gateway SDK. Instead, it records payment method and reference locally. Failures here are typically:

| Symptom | Likely Cause | Diagnostic Check |
|---|---|---|
| "Card reference required" | User did not enter card ref | Check `cardRef` field in payload |
| "Split amounts must equal total" | Cash + Card split mismatches total | Check `splitPayments` sum vs `totalAmount` |
| Sale saved but payment not recorded | `amountPaid` not passed correctly | Check `amountPaid` field in payload |
| `paymentStatus` stuck on PENDING | `paymentMethod` invalid enum value | Check `paymentMethod` matches `PaymentMethod` enum |

**Checklist:**
- [ ] Verify `paymentMethod` is one of: `CASH`, `CARD`, `BANK_TRANSFER`, `MOBILE_MONEY`, `SPLIT`
- [ ] For `CARD`/`BANK_TRANSFER`/`MOBILE_MONEY`: verify reference field is non-empty
- [ ] For `SPLIT`: verify `splitPayments` array sums to `totalAmount` within `0.01` tolerance
- [ ] Check that `amountPaid >= totalAmount` for non-CASH methods (server uses `changeAmount = max(0, amountPaid - totalAmount)`)

### 1B. Session Management Errors

| Symptom | Likely Cause | Diagnostic Check |
|---|---|---|
| 401 Unauthorized response | Session expired or missing | Check `auth()` return value |
| "User is not assigned to a branch" | `session.user.branchId` is null/undefined | Check user record in DB |
| Intermittent 401 on slow networks | Session cookie not sent with request | Check `credentials` mode on fetch |
| Checkout works then fails after idle | NextAuth session TTL exceeded | Check `AUTH_SECRET` and session config |

**Checklist:**
- [ ] Verify session is valid at the time of checkout (not expired)
- [ ] Verify `session.user.branchId` is set and non-empty
- [ ] Verify `session.user.id` is set (used as `cashierId`)
- [ ] Check if session cookie is included in `fetch('/api/pos/checkout')` request (NextAuth should handle this automatically via cookies)
- [ ] Check for concurrent sessions invalidating each other

### 1C. Database Transaction Errors

| Symptom | Likely Cause | Diagnostic Check |
|---|---|---|
| "Insufficient stock" | Inventory quantity < sale quantity | Check `inventory.quantity` before sale |
| "Branch settings not found" | No `BranchSetting` record for this branch | Check `branchSetting` table |
| Unique constraint violation on `sku` | Duplicate SKU in product creation | Check `product.sku` uniqueness |
| Transaction deadlock | Concurrent sales for same product | Check Prisma query logs |
| `Decimal` conversion errors | Non-numeric values in price/quantity fields | Validate item `unitPrice` and `quantity` |
| Receipt number collision | `receiptNextNum` race condition | See Step 5 below |

**Checklist:**
- [ ] Run `prisma.$transaction` in isolation with a test payload
- [ ] Check Prisma query log (`log: ['query', 'error', 'warn']` in dev)
- [ ] Verify inventory quantities are sufficient for all items
- [ ] Verify `branchSetting` record exists for the branch
- [ ] Check for concurrent `receiptNextNum` increments (race condition)

### 1D. API Latency / Timeout Errors

| Symptom | Likely Cause | Diagnostic Check |
|---|---|---|
| Sale completes but page hangs | Response not returned within timeout | Check browser network tab |
| "Checkout failed" with no message | Fetch `res.ok` is false but response body is empty | Check server logs |
| Offline sale never syncs | `navigator.onLine` is false or sync engine never triggers | Check `online`/`offline` events |
| Slow response on first checkout | Cold start (Prisma client instantiation) | Check latency on first vs subsequent requests |
| Partial data in receipt | Some items created, others failed mid-transaction | Check `sale.items` count vs cart count |

**Checklist:**
- [ ] Measure API response time in browser DevTools (Network tab)
- [ ] Check if DB connection pool is exhausted (PostgreSQL `max_connections`)
- [ ] Check if `DATABASE_URL` is accessible from the deployment region
- [ ] Verify the sync engine's `navigator.onLine` check is accurate
- [ ] Add client-side timeout handling (currently missing — see improvements below)

---

## Step 2: Diagnostic Procedure

### 2.1 Server-Side Diagnostics

1. **Check server logs for the checkout request:**
   ```bash
   # If running locally
   grep -i "checkout\|createSale\|error" server.log

   # If on Vercel
   vercel logs dite-pos --tail
   ```

2. **Check Prisma query log output** (in development):
   - Set `LOG_LEVEL=debug` in `.env.local`
   - Restart the dev server
   - Look for queries related to `sale.create`, `inventory.update`, `branchSetting.update`

3. **Test the checkout API directly:**
   ```bash
   curl -X POST https://dite-pos.vercel.app/api/pos/checkout \
     -H "Content-Type: application/json" \
     -H "Cookie: __Secure-next-auth.session-token=<token>" \
     -d '{
       "items": [{"productId": "test", "quantity": 1, "unitPrice": 100}],
       "paymentMethod": "CASH",
       "amountPaid": 100,
       "subtotal": 100,
       "totalAmount": 100,
       "changeAmount": 0
     }'
   ```

4. **Verify database state after a failed checkout:**
   ```sql
   -- Check if partial sale was created
   SELECT * FROM sales WHERE created_at > NOW() - INTERVAL '5 minutes';

   -- Check inventory state
   SELECT * FROM inventories WHERE product_id IN (
     SELECT product_id FROM sale_items WHERE sale_id = '<sale_id>'
   );

   -- Check branch settings
   SELECT * FROM branch_settings WHERE branch_id = '<branch_id>';
   ```

### 2.2 Client-Side Diagnostics

1. **Open browser DevTools > Console** and filter for `[ERROR]` or `[CHECKOUT]`
2. **Open Network tab** and trigger a checkout — look for:
   - The `POST /api/pos/checkout` request
   - Status code (200 = success, 400 = validation, 401 = auth, 500 = server error)
   - Response body (contains `error` field on failure)
   - Request payload (contains all sale data)
3. **Check `localStorage`** for cart persistence:
   ```javascript
   localStorage.getItem('cartDraft')
   ```
4. **Check Dexie (IndexedDB)** for offline sales queue:
   ```javascript
   // In browser console
   const db = await import('@/lib/offline/dexie-db');
   const queue = await db.db.salesQueue.toArray();
   console.log(queue.filter(s => s.status === 'PENDING' || s.status === 'FAILED'));
   ```

### 2.3 Offline Sync Diagnostics

1. **Check sync queue status:**
   ```javascript
   // In browser console
   const queue = await syncEngine.getQueue();
   queue.filter(s => s.status !== 'SYNCED').forEach(s => {
     console.log(s.id, s.status, s.retries, s.lastError);
   });
   ```

2. **Manually trigger sync:**
   ```javascript
   await syncEngine.processQueue();
   ```

3. **Check for stale PENDING items:**
   - Items with `status === 'FAILED'` and `retries >= 5` are abandoned
   - Items stuck in `SYNCING` status indicate a crashed sync process

---

## Step 3: Key Failure Points and Fixes

### 3.1 Race Condition in Receipt Number Generation

**Problem:** Multiple concurrent checkout requests can read the same `receiptNextNum` value before any of them increment it, causing duplicate receipt numbers.

**Location:** `src/lib/actions/sales.ts` — the `receiptNextNum` increment inside `prisma.$transaction`.

**Note:** While Prisma transactions provide isolation, the `findUnique` then `update` pattern for `branchSetting` is susceptible to lost updates. The `increment` operation in `update` is atomic at the DB level, but the read-then-use pattern for generating the receipt number is not.

**Fix:** Use a database-level atomic increment and read the generated value in a single operation.

### 3.2 Inventory Race Condition

**Problem:** The pattern `findFirst` → `updateMany` for inventory is not atomic. Two concurrent sales for the same product can both pass the stock check before either decrements the inventory.

**Location:** `src/lib/actions/sales.ts` — inventory check and decrement loop.

**Fix:** Use an atomic `updateMany` with a `where` clause that checks `quantity >= saleQuantity` in a single query, and verify the `updated.count > 0`.

### 3.3 No Client-Side Timeout on Checkout

**Problem:** The `fetch('/api/pos/checkout')` call has no timeout. If the server is slow or unresponsive, the checkout can hang indefinitely.

**Location:** `src/components/pos/checkout-modal.tsx` — `checkoutMutation.mutationFn`.

**Fix:** Add an `AbortController` with a configurable timeout.

### 3.4 Sync Engine Doesn't Use Exponential Backoff

**Problem:** The `syncEngine.processQueue()` processes all items sequentially without any delay between retries. `getBackoffDelay` is defined but never called.

**Location:** `src/lib/offline/sync-engine.ts` — `processQueue()`.

**Fix:** Implement backoff delay between retry attempts.

### 3.5 Insufficient Server-Side Logging

**Problem:** The checkout API catches errors but does not log them server-side. The `createSale` function throws raw Prisma errors that may expose internal details.

**Location:** `src/app/api/pos/checkout/route.ts` and `src/lib/actions/sales.ts`.

**Fix:** Add structured logging with request context at all failure points.

### 3.6 No Idempotency on Checkout

**Problem:** If the client retries a failed checkout (e.g., double-click), a second sale record is created. There is no idempotency key or deduplication mechanism.

**Location:** Entire checkout flow.

**Fix:** Add an idempotency key to the checkout payload and check for duplicate requests server-side.

---

## Step 4: Logging Strategy

### 4.1 Server-Side Logging Additions

Add logging at these points in the checkout flow:

1. **Checkout API entry** — log request metadata (method, path, session user, timestamp)
2. **Validation failure** — log the Zod validation errors
3. **createSale start/end** — log sale ID, item count, total amount, duration
4. **Inventory check failure** — log product ID, available quantity, requested quantity
5. **Branch setting failure** — log branch ID
6. **Transaction error** — log the error with full context (sanitized)
7. **Sync engine** — log each queue item processing attempt with success/failure

### 4.2 Client-Side Logging Additions

1. **Checkout request start** — log payload summary (item count, total, payment method)
2. **Checkout response** — log status code and response body
3. **Checkout error** — log error message and duration
4. **Offline save** — log the queued sale ID and timestamp
5. **Sync start/complete** — log number of items processed, successes, failures

### 4.3 Logging Levels

| Level | When to Use | Example |
|---|---|---|
| `debug` | Detailed flow tracing in development | "createSale: starting transaction for 3 items" |
| `info` | Successful checkout events | "Checkout completed: saleId=abc, receiptNo=RCP-20260727-00001" |
| `warn` | Recoverable issues | "Inventory low for product XYZ: 2 remaining" |
| `error` | Failed checkouts, sync failures | "Checkout failed: Insufficient stock for Product Name" |

---

## Step 5: Error-Handling Improvements

### 5.1 Structured Error Codes

Replace generic error messages with structured error codes that the client can act on:

```
CHECKOUT_VALIDATION_ERROR    — Zod validation failed (400)
CHECKOUT_UNAUTHORIZED        — Session invalid (401)
CHECKOUT_OFFLINE             — User is offline and no offline queue available
CHECKOUT_INSUFFICIENT_STOCK  — Inventory below required quantity (409)
CHECKOUT_BRANCH_NOT_FOUND    — Branch settings missing (500)
CHECKOUT_DUPLICATE_SALE      — Idempotency key already processed (409)
CHECKOUT_TIMEOUT             — Server did not respond in time (504)
CHECKOUT_SYNC_FAILED         — Offline sync failed permanently (400)
```

### 5.2 Client-Side Error Recovery

1. **Network timeout** — Show "Connection timed out, check your network" and offer "Retry"
2. **Insufficient stock** — Highlight the specific item and suggest alternatives
3. **Duplicate sale** — Detect idempotency conflict and show "This sale was already processed" with receipt number
4. **Offline queue full** — Warn user and offer to hold sale for later
5. **Sync failure after max retries** — Allow manual retry or clear from queue

### 5.3 Server-Side Error Recovery

1. **Database constraint violations** — Wrap Prisma errors in typed error classes
2. **Deadlocks** — Implement automatic retry with jitter (3 attempts)
3. **Partial failures** — Use savepoints or compensate with reversal actions
4. **Graceful degradation** — If printing fails after successful sale, queue print job for retry