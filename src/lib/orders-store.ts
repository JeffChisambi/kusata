/**
 * Orders store — client-only module-level store for the broker order blotter.
 *
 * KNOWN LIMITATION: Orders are not fetched from the API. The store starts
 * empty and is populated only through broker UI actions (execute, reject,
 * cancel). See docs/backend-changes-required.md for the API integration plan.
 *
 * SSR guard: module-level mutable state is shared across concurrent SSR
 * requests in Node.js. We guard against that by no-op-ing all mutations
 * on the server and returning empty state for reads.
 */

export type OrderStatus = "READY" | "PARTIAL" | "EXECUTED" | "CANCELLED" | "REJECTED" | "REVIEW";
export type OrderSide = "BUY" | "SELL";
export type RiskLevel = "LOW" | "REVIEW";

export type Order = {
  id: string;
  client: string;
  clientId: string;
  account: string;
  ticker: string;
  company: string;
  side: OrderSide;
  quantity: number;
  filled: number;
  limitPrice: number;
  value: number;
  status: OrderStatus;
  received: string;
  executed?: string;
  exchange: string;
  tif: "DAY" | "GTC";
  channel: "Mobile app" | "Web portal" | "Broker assisted";
  risk: RiskLevel;
  instructions: string;
};

const isServer = typeof window === 'undefined';

let _orders: Order[] = [];
const _listeners = new Set<() => void>();

function notify() {
  if (isServer) return;
  _listeners.forEach((l) => l());
}

export const ordersStore = {
  getAll(): Order[] {
    if (isServer) return [];
    return _orders;
  },
  getById(id: string): Order | undefined {
    if (isServer) return undefined;
    return _orders.find((o) => o.id === id);
  },
  update(id: string, patch: Partial<Order>) {
    if (isServer) return;
    _orders = _orders.map((o) => (o.id === id ? { ...o, ...patch } : o));
    notify();
  },
  add(order: Order) {
    if (isServer) return;
    _orders = [order, ..._orders];
    notify();
  },
  /** Replace the full blotter — called after a fresh API fetch. */
  setAll(orders: Order[]) {
    if (isServer) return;
    _orders = orders;
    notify();
  },
  subscribe(listener: () => void): () => void {
    if (isServer) return () => {};
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
