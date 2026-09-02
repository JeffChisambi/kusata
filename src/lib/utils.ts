import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shared `validateSearch` for routes that take no search params. Hoisted so
 * the router sees a stable function reference instead of a fresh closure per
 * route definition.
 */
export const noSearchParams = (): Record<string, never> => ({});
