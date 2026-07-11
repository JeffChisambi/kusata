# Pine – Broker Admin Dashboard

A React + TanStack Start (SSR) admin dashboard for a brokerage platform, built with Vite, Tailwind CSS v4, and shadcn/ui components. Originally created with [Lovable](https://lovable.dev).

## Stack

- **Framework**: TanStack Start (TanStack Router + SSR via Nitro)
- **Build tool**: Vite 8 via `@lovable.dev/vite-tanstack-config`
- **UI**: React 19, Tailwind CSS v4, Radix UI primitives, shadcn/ui
- **Package manager**: Bun

## Running the app

```bash
bun run dev
```

Starts the dev server at `http://localhost:5000`.

## Key configuration notes

- `vite.config.ts` overrides `@lovable.dev/vite-tanstack-config`'s default IPv6 host (`::`) with `0.0.0.0:5000` using the `vite.server` option — required for Replit (IPv6 not supported).
- All shadcn/ui components live in `src/components/ui/`.
- Routes are file-based under `src/routes/` (TanStack Router). `src/routeTree.gen.ts` is auto-generated.

## User preferences

_None recorded yet._
