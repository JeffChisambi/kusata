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

const INITIAL_ORDERS: Order[] = [
  {
    id: "ORD-5047",
    client: "Madalitso Mbewe",
    clientId: "U-0118",
    account: "Individual · 0048",
    ticker: "NBM",
    company: "National Bank of Malawi",
    side: "BUY",
    quantity: 240,
    filled: 0,
    limitPrice: 185,
    value: 44_400,
    status: "READY",
    received: "09:42",
    exchange: "MSE",
    tif: "DAY",
    channel: "Mobile app",
    risk: "LOW",
    instructions: "Execute at limit price or better. Client has sufficient buying power.",
  },
  {
    id: "ORD-5046",
    client: "Tadala Phiri",
    clientId: "U-0017",
    account: "Individual · 0112",
    ticker: "FDH",
    company: "FDH Financial Holdings",
    side: "SELL",
    quantity: 400,
    filled: 160,
    limitPrice: 46,
    value: 18_400,
    status: "PARTIAL",
    received: "09:35",
    exchange: "MSE",
    tif: "DAY",
    channel: "Web portal",
    risk: "LOW",
    instructions: "Complete the remaining balance during today's session.",
  },
  {
    id: "ORD-5045",
    client: "Chisomo Banda",
    clientId: "U-0041",
    account: "Individual · 0091",
    ticker: "AIRTEL",
    company: "Airtel Malawi Ltd",
    side: "BUY",
    quantity: 500,
    filled: 0,
    limitPrice: 21,
    value: 10_500,
    status: "READY",
    received: "09:28",
    exchange: "MSE",
    tif: "GTC",
    channel: "Mobile app",
    risk: "LOW",
    instructions: "Good till cancelled. Do not route above the stated limit.",
  },
  {
    id: "ORD-5044",
    client: "Grace Mwale",
    clientId: "U-0082",
    account: "Individual · 0063",
    ticker: "STANDARD",
    company: "Standard Bank Malawi",
    side: "SELL",
    quantity: 80,
    filled: 0,
    limitPrice: 280,
    value: 22_400,
    status: "READY",
    received: "09:17",
    exchange: "MSE",
    tif: "DAY",
    channel: "Broker assisted",
    risk: "REVIEW",
    instructions: "Confirm the client callback before routing this order.",
  },
  {
    id: "ORD-5043",
    client: "Mercy Chirwa",
    clientId: "U-0093",
    account: "Individual · 0027",
    ticker: "TNM",
    company: "Telekom Networks Malawi",
    side: "BUY",
    quantity: 1_000,
    filled: 1_000,
    limitPrice: 18.2,
    value: 18_200,
    status: "EXECUTED",
    received: "08:58",
    executed: "09:04",
    exchange: "MSE",
    tif: "DAY",
    channel: "Mobile app",
    risk: "LOW",
    instructions: "Execute at limit price or better.",
  },
  {
    id: "ORD-5042",
    client: "Peter Gondwe",
    clientId: "U-0055",
    account: "Individual · 0079",
    ticker: "ILLOVO",
    company: "Illovo Sugar Malawi",
    side: "BUY",
    quantity: 30,
    filled: 0,
    limitPrice: 1_060,
    value: 31_800,
    status: "REVIEW",
    received: "08:40",
    exchange: "MSE",
    tif: "DAY",
    channel: "Web portal",
    risk: "REVIEW",
    instructions: "Client requested a callback before execution.",
  },
  {
    id: "ORD-5041",
    client: "Stella Tembo",
    clientId: "U-0064",
    account: "Individual · 0038",
    ticker: "AIRTEL",
    company: "Airtel Malawi Ltd",
    side: "SELL",
    quantity: 300,
    filled: 300,
    limitPrice: 21.4,
    value: 6_420,
    status: "EXECUTED",
    received: "08:12",
    executed: "08:18",
    exchange: "MSE",
    tif: "DAY",
    channel: "Mobile app",
    risk: "LOW",
    instructions: "Execute at limit price or better.",
  },
];

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
