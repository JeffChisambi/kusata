# Backend Changes Required

This document describes changes that cannot be made purely in the frontend. Each section explains the problem, the frontend impact, and what the backend needs to provide.

---

## 1. httpOnly Cookie Auth — Enables Server-Side Auth Guard

### Problem
Access and refresh tokens are stored in `localStorage`. The server-side auth guard in `src/routes/__root.tsx` (`beforeLoad`) skips all checks when `typeof window === 'undefined'`, meaning:

- The server renders every route (including protected ones) without any auth check.
- The SSR output is always an unauthenticated shell. The browser then re-runs `isAuthenticated()` from `localStorage` and redirects if needed.
- This negates most SSR benefits: the server can't pre-render protected pages with real data.
- If server-side data loaders are ever added (TanStack Start supports them), they'd run with no auth enforcement on the server.

### What the backend needs to provide

1. **Set tokens as `httpOnly; Secure; SameSite=Strict` cookies** on all auth endpoints:
   - `POST /v1/admin/auth/mfa/confirm-setup` — after MFA setup
   - `POST /v1/admin/auth/mfa/verify` — after MFA verification
   - `POST /v1/admin/auth/mfa/recovery` — after recovery code use
   - `POST /v1/admin/auth/refresh` — on token refresh

2. **Accept the access token from the cookie** on all protected endpoints (in addition to or instead of the `Authorization` header). The frontend will stop sending the `Authorization` header once cookies are the source of truth.

3. **Clear cookies on logout**: `POST /v1/admin/auth/logout` should `Set-Cookie` with an expired/empty value.

### Frontend changes that follow (once backend is ready)

- Remove all `localStorage.setItem/getItem` for tokens in `src/lib/auth.ts`
- Remove `Authorization` header injection in `src/lib/api.ts`
- Remove the `if (typeof window === 'undefined') return;` guard in `beforeLoad` — the server will now be able to check the cookie from `Request` headers
- Enable real server-side auth: redirect unauthenticated SSR requests before any component renders

---

## 2. Orders API — Replace the Local-Only Order Store

### Problem
The broker order blotter (`/orders`, `/orders/$orderId`) uses a module-level in-memory store (`src/lib/orders-store.ts`). Orders are **never fetched from the API** — the store starts empty and only holds local broker UI actions (execute, partial fill, reject, cancel).

This means:
- Orders are lost on every page refresh.
- Two broker sessions never see each other's state.
- Local order mutations (execute, reject) are never persisted to the backend.

### What the backend needs to provide

#### `GET /v1/admin/orders` — paginated order blotter
```
Query params:
  status   string   Filter by order status (READY, PARTIAL, EXECUTED, CANCELLED, REJECTED, REVIEW)
  side     string   BUY | SELL
  page     number   1-based page number
  limit    number   Page size (default 50)

Response:
  {
    orders: Order[],
    total: number,
    page: number,
    totalPages: number
  }
```

Where `Order` matches the type in `src/lib/orders-store.ts`.

#### `POST /v1/admin/orders/:orderId/execute`
```
Body:  { quantity: number }
Returns: updated Order
```

#### `POST /v1/admin/orders/:orderId/reject`
```
Body:  { reason?: string }
Returns: updated Order
```

#### `POST /v1/admin/orders/:orderId/cancel`
```
Returns: updated Order
```

### Frontend changes that follow (once backend is ready)

1. Add `src/hooks/useOrders.ts` using `queryKeys.trading.orders(filters)` and `queryKeys.trading.order(id)`.
2. Replace `ordersStore.getAll()` / `subscribe()` in `orders.index.tsx` with `useOrders()`.
3. Replace `ordersStore.getById()` in `orders.$orderId.tsx` with `useOrder(orderId)`.
4. Replace local `ordersStore.update()` calls with mutations that call the execute/reject/cancel endpoints, using optimistic updates for instant UI feedback.
5. Add `refetchInterval: 15_000, refetchIntervalInBackground: false` to `useOrders` so the blotter stays live.

The `ordersStore` can be deleted once the API is integrated. The `setAll()` method added during the SSR-guard fix was included to make the future migration easier.

---

## 3. User List Invalidation After KYC Review

### Problem (context)
`useApproveKyc` and `useRejectKyc` previously invalidated `queryKeys.users.all` (the entire user cache) on every review action. This was narrowed to only `queryKeys.kyc.all` and `queryKeys.dashboard.stats()` in the frontend fix.

**If the backend updates user KYC status synchronously** as part of the approve/reject response, the frontend should also invalidate `queryKeys.users.list(...)` for whichever filters the user list page is currently using.

### Options

**Option A — Backend returns affected userId in the mutation response**
```json
{ "applicationId": "...", "userId": "...", "newStatus": "APPROVED" }
```
The frontend can then do a targeted `queryClient.invalidateQueries({ queryKey: queryKeys.users.workspace(userId) })` without busting the full list cache.

**Option B — Accept full list re-fetch on review**
Re-add `queryClient.invalidateQueries({ queryKey: queryKeys.users.list() })` (list only, not `users.all`) in the `onSuccess` handlers. This is simpler but slightly heavier.

Option A is preferred for scale. Option B is a quick safe fallback.

---

## 4. Notification Status Values — Unread Count Calculation

### Problem
`src/hooks/useNotifications.ts` exports `useUnreadNotificationCount()` which calls `GET /v1/admin/notifications/stats` and computes unread count by summing all statuses that are not `READ` or `DELIVERED`:

```ts
const READ_STATUSES = new Set(['READ', 'DELIVERED']);
return data.byStatus
  .filter((s) => !READ_STATUSES.has(s.status.toUpperCase()))
  .reduce((sum, s) => sum + s.count, 0);
```

### What the backend should confirm
Document the complete set of status values returned in `byStatus`. If the API uses different terminal status names (e.g. `SEEN`, `OPENED`, `CONSUMED`), update the `READ_STATUSES` set in `src/hooks/useNotifications.ts` accordingly.

If the backend can expose an `unreadCount: number` field directly on the `/stats` response, that's even better — update the hook to use it directly and remove the client-side computation.

---

## 5. KYC Store — Confirm Unused and Delete

`src/lib/kyc-store.ts` defines a module-level `kycStore` that is **not imported anywhere** in the codebase. KYC state is managed entirely through TanStack Query (`src/hooks/useKyc.ts`).

**Action required**: Confirm this was an early draft, then delete `src/lib/kyc-store.ts`. The SSR guard added in the current fix prevents any harm in the meantime, but the file is dead code.
