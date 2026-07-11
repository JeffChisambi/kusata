---
name: TanStack Start SSR hydration crashes
description: Client-only APIs (localStorage, matchMedia, window) read inside useState initializers cause hydration mismatches that crash the app in TanStack Start.
---

Reading `localStorage`, `window.matchMedia`, or other browser-only APIs directly inside a `useState(() => ...)` initializer (or during initial render) causes the server-rendered HTML to differ from the client's first render. React's hydration then throws an unhandled error, and the whole page/tree crashes instead of just warning.

**Why:** The server always renders with a fixed default (since `window`/`localStorage` don't exist there), but the client's first render can immediately pick up the real stored/preferred value — the two renders disagree before hydration completes, which React treats as fatal for the affected subtree.

**How to apply:** For any state that depends on browser-only storage/APIs (theme/dark-mode toggles, viewport-based flags, feature flags in localStorage, etc.), initialize state to a fixed default (e.g. `false`), then read the real value inside a `useEffect` (which only runs client-side) and update state there. Gate any side effects that depend on the real value (e.g. writing back to localStorage or the DOM) with a `mounted` flag so they don't fire with the placeholder default before sync.
