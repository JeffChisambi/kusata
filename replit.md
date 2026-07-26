# Pine Broker Admin

A brokerage administration portal built with TanStack Start (React SSR), Tailwind CSS v4, and Radix UI / shadcn components.

## What it does

Two distinct dashboards behind a single login:
- **Admin / Executive Dashboard** (`/`) — overview stats, user management, KYC compliance queue, orders, notifications, settings
- **Broker Dashboard** (`/broker`) — broker-specific task view

Key sections: Users, KYC Management, Orders, Notifications, Settings.

## Stack

| Layer | Tech |
|---|---|
| Framework | TanStack Start (SSR React) + TanStack Router |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix UI primitives) |
| Data fetching | TanStack Query (React Query v5) |
| Auth | JWT in localStorage + multi-step MFA flow |
| Backend API | `https://api.kapwanje.com` (configured via `VITE_API_URL`) |
| Runtime | Bun + Vite |

## How to run

```bash
bun install
bun run dev        # dev server on port 5000
bun run build      # SSR production build (node-server preset)
```

## Project layout

```
src/
  routes/          # File-based routes (TanStack Router)
    __root.tsx     # Root layout + role-based auth guards
    login.tsx      # Login + MFA flow
    index.tsx      # Admin dashboard
    broker.tsx     # Broker dashboard
    users.tsx      # User management
    kyc.tsx        # KYC compliance
    orders/        # Order management
    notifications.tsx
    settings.tsx
  components/
    ui/            # shadcn/ui component library
    admin-shell.tsx / broker-shell.tsx / role-shell.tsx  # Layout shells
  lib/
    api.ts         # Fetch-based API client (auth headers, token refresh, 401 interceptor)
    auth.ts        # JWT + AdminUser state (localStorage)
    query-keys.ts  # Centralised React Query key factory
    kyc-store.ts / orders-store.ts  # Module-level shared state
  hooks/
    useAuth.ts     # Reactive auth hook (useSyncExternalStore)
```

## Auth flow

Login → MFA setup (first time) or MFA verify → Recovery codes → redirect by role (`admin` → `/`, `broker` → `/broker`). Route guards in `__root.tsx` enforce this.

## Environment variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (set in `.env`) |
| `SESSION_SECRET` | Server session secret (Replit secret) |

## User preferences

- Keep the existing project structure and stack — no migrations or restructuring without explicit request.
