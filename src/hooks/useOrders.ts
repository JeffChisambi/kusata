import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

// ── Backend types (Prisma model shape) ────────────────────────────────────────

export type BackendOrderStatus =
  | 'DRAFT'
  | 'PENDING_VALIDATION'
  | 'VALIDATED'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'PENDING_SETTLEMENT'
  | 'SETTLED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type OrderSide = 'BUY' | 'SELL';

/** Raw shape returned by `GET /v1/admin/trading/orders` */
export interface BackendOrder {
  id: string;
  userId: string;
  stockId: string;
  side: OrderSide;
  type: string;
  status: BackendOrderStatus;
  quantity: string; // Decimal comes as string from Prisma
  filledQuantity: string;
  limitPrice: string | null;
  averageFillPrice: string | null;
  totalFees: string;
  totalCost: string;
  rejectionReason: string | null;
  brokerRef: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  filledAt: string | null;
  cancelledAt: string | null;
  user: { id: string; firstName: string; lastName: string };
  stock: { symbol: string; name: string };
}

/** Raw shape returned by `GET /v1/admin/trading/orders/:id` */
export interface BackendOrderDetail extends BackendOrder {
  user: { id: string; firstName: string; lastName: string; phone: string };
  stock: { symbol: string; name: string; sector: string | null };
  trades: Array<{
    id: string;
    quantity: string;
    price: string;
    fee: string;
    settledAt: string | null;
    createdAt: string;
    settlement: { id: string; status: string } | null;
  }>;
  executions: Array<{
    id: string;
    quantity: string;
    price: string;
    executedAt: string;
  }>;
  audits: Array<{
    id: string;
    action: string;
    details: string | null;
    createdAt: string;
  }>;
}

// ── Display types (what the UI renders) ───────────────────────────────────────

export type DisplayStatus = 'READY' | 'PARTIAL' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PENDING' | 'SETTLED';

export interface Order {
  id: string;
  client: string;
  clientId: string;
  ticker: string;
  company: string;
  side: OrderSide;
  type: string;
  quantity: number;
  filled: number;
  limitPrice: number;
  avgFillPrice: number | null;
  value: number;
  fees: number;
  status: DisplayStatus;
  backendStatus: BackendOrderStatus;
  received: string;
  executed: string | null;
  rejectionReason: string | null;
  brokerRef: string | null;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapStatus(s: BackendOrderStatus): DisplayStatus {
  switch (s) {
    case 'DRAFT':
    case 'PENDING_VALIDATION':
    case 'VALIDATED':
    case 'SUBMITTED':
    case 'ACCEPTED':
      return 'READY';
    case 'PARTIALLY_FILLED':
      return 'PARTIAL';
    case 'FILLED':
    case 'COMPLETED':
      return 'EXECUTED';
    case 'PENDING_SETTLEMENT':
    case 'SETTLED':
      return 'SETTLED';
    case 'REJECTED':
    case 'EXPIRED':
      return 'REJECTED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

function mapOrder(o: BackendOrder): Order {
  const qty = parseFloat(o.quantity) || 0;
  const filled = parseFloat(o.filledQuantity) || 0;
  const limit = parseFloat(o.limitPrice ?? '0') || 0;
  const avgFill = o.averageFillPrice ? parseFloat(o.averageFillPrice) : null;
  return {
    id: o.id,
    client: `${o.user.firstName} ${o.user.lastName}`,
    clientId: o.userId,
    ticker: o.stock.symbol,
    company: o.stock.name,
    side: o.side,
    type: o.type,
    quantity: qty,
    filled,
    limitPrice: limit,
    avgFillPrice: avgFill,
    value: parseFloat(o.totalCost) || qty * limit,
    fees: parseFloat(o.totalFees) || 0,
    status: mapStatus(o.status),
    backendStatus: o.status,
    received: o.createdAt,
    executed: o.filledAt,
    rejectionReason: o.rejectionReason,
    brokerRef: o.brokerRef,
  };
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export interface OrderFilters {
  status?: string;
  side?: OrderSide;
  page?: number;
  limit?: number;
}

export function useOrders(filters: OrderFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.side) params.set('side', filters.side);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit ?? 50));

  const qs = params.toString();

  return useQuery({
    queryKey: queryKeys.trading.orders(filters as Record<string, unknown>),
    queryFn: async () => {
      const raw = await api.get<{
        orders: BackendOrder[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/v1/admin/trading/orders${qs ? `?${qs}` : ''}`);

      return {
        orders: raw.orders.map(mapOrder),
        total: raw.total,
        page: raw.page,
        totalPages: raw.totalPages,
      };
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.trading.order(orderId ?? ''),
    queryFn: async () => {
      const raw = await api.get<BackendOrderDetail>(`/v1/admin/trading/orders/${orderId}`);
      return {
        ...mapOrder(raw),
        user: raw.user,
        stock: raw.stock,
        trades: raw.trades,
        executions: raw.executions,
        audits: raw.audits,
      };
    },
    enabled: !!orderId,
  });
}

/** Convenience: call from a Refresh button to force re-fetch */
export function useRefreshOrders() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.trading.all });
}
