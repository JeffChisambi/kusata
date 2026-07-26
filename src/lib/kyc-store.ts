import type { KycApplicationRow } from "@/hooks/useKyc";

let _applications: KycApplicationRow[] = [];
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((l) => l());
}

export const kycStore = {
  getAll(): KycApplicationRow[] {
    return _applications;
  },
  getById(id: string): KycApplicationRow | undefined {
    return _applications.find((a) => a.id === id);
  },
  update(id: string, patch: Partial<KycApplicationRow>) {
    _applications = _applications.map((a) => (a.id === id ? { ...a, ...patch } : a));
    notify();
  },
  subscribe(listener: () => void): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
