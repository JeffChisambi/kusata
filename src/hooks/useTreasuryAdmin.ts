import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type TreasuryProduct = {
  id: string;
  label: string;
  tenorDays: number;
  duration: number;
  yieldPct: number;
  yieldPercent: number;
  minInvestment: number;
  minAmount: number;
  maxInvestment: number | null;
  riskLevel: string;
  auctionDate: string;
  issueDate: string;
  maturityDate: string;
  nextAuction: string;
  status: string;
  currency: string;
  isActive: boolean;
};

export type TreasuryInvestment = {
  investmentId: string;
  status: string;
  amount: string;
  yieldPercent: number;
  earnings: string;
  maturityValue: string;
  maturityDate: string;
  createdAt: string;
  product?: TreasuryProduct;
  user?: { id: string; name: string; phone: string } | null;
};

export type TreasuryProductInput = {
  label: string;
  tenorDays: number;
  yieldPercent: number;
  minAmount: number;
  maxAmount?: number | null;
  riskLevel?: string;
  auctionDate?: string;
  issueDate?: string;
  maturityDate?: string;
  status?: string;
  isActive?: boolean;
  currency?: string;
};

const keys = {
  all: ['treasury-admin'] as const,
  products: () => [...keys.all, 'products'] as const,
  investments: () => [...keys.all, 'investments'] as const,
};

export function useTreasuryProducts() {
  return useQuery<{ products: TreasuryProduct[] }>({
    queryKey: keys.products(),
    queryFn: () => api.get('/v1/admin/treasury/products'),
    staleTime: 15_000,
  });
}

export function useTreasuryInvestments() {
  return useQuery<{ investments: TreasuryInvestment[] }>({
    queryKey: keys.investments(),
    queryFn: () => api.get('/v1/admin/treasury/investments'),
    staleTime: 15_000,
  });
}

export function useCreateTreasuryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TreasuryProductInput) => api.post('/v1/admin/treasury/products', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateTreasuryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TreasuryProductInput> }) =>
      api.patch(`/v1/admin/treasury/products/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteTreasuryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/admin/treasury/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
