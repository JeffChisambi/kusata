/**
 * Navigation registry — lets non-React code (ApiClient) trigger router
 * navigation without importing the router directly.
 *
 * Usage:
 *   1. In the root component, call registerNavigate(navigate) once.
 *   2. Anywhere else, call navigateTo('/login') instead of window.location.href.
 */

type NavigateFn = (to: string) => void;

let _navigate: NavigateFn | null = null;

export function registerNavigate(fn: NavigateFn): void {
  _navigate = fn;
}

export function navigateTo(to: string): void {
  if (_navigate) {
    _navigate(to);
  } else {
    // Fallback: router not yet mounted (e.g. very early in boot).
    // Use replace so the login page isn't added to browser history.
    if (typeof window !== 'undefined') {
      window.location.replace(to);
    }
  }
}
