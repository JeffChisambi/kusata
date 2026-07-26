/**
 * KYC store — client-only module-level store.
 *
 * NOTE: This store is currently unused — KYC state is managed entirely through
 * TanStack Query in useKyc.ts. It is kept here in case local optimistic updates
 * are needed in the future, but can be deleted if confirmed unnecessary.
 *
 * SSR guard: module-level mutable state is shared across concurrent SSR
 * requests in Node.js. We guard against that by no-op-ing all mutations
 * on the server and returning empty state for reads.
 */

import type { KycApplicationRow } from "@/hooks/useKyc";

const isServer = typeof window === 'undefined';

let _applications: KycApplicationRow[] = [];
const _listeners = new Set<() => void>();

function notify() {
  if (isServer) return;
  _listeners.forEach((l) => l());
}

export const kycStore = {
  getAll(): KycApplicationRow[] {
    if (isServer) return [];
    return _applications;
  },
  getById(id: string): KycApplicationRow | undefined {
    if (isServer) return undefined;
    return _applications.find((a) => a.id === id);
  },
  update(id: string, patch: Partial<KycApplicationRow>) {
    if (isServer) return;
    _applications = _applications.map((a) => (a.id === id ? { ...a, ...patch } : a));
    notify();
  },
  subscribe(listener: () => void): () => void {
    if (isServer) return () => {};
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
