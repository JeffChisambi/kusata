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

// Orders are loaded from the API. This store starts empty and is populated
// at runtime via ordersStore.add() or bulk-loaded by an API hook.
const INITIAL_ORDERS: Order[] = [];

// Simple module-level store so list and detail pages share the same state.
let _orders: Order[] = [...INITIAL_ORDERS];
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((l) => l());
}

export const ordersStore = {
  getAll(): Order[] {
    return _orders;
  },
  getById(id: string): Order | undefined {
    return _orders.find((o) => o.id === id);
  },
  update(id: string, patch: Partial<Order>) {
    _orders = _orders.map((o) => (o.id === id ? { ...o, ...patch } : o));
    notify();
  },
  add(order: Order) {
    _orders = [order, ..._orders];
    notify();
  },
  subscribe(listener: () => void): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
