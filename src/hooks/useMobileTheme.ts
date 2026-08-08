import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export const BRAND_KEYS = [
  'primary', 'accent', 'background', 'card',
  'text', 'mutedForeground', 'border', 'destructive',
] as const;
export type BrandKey = (typeof BRAND_KEYS)[number];
export type ThemeColors = Partial<Record<BrandKey, string>>;

export type MobileThemeResponse = {
  colors: ThemeColors | null;
  defaults: Record<BrandKey, string>;
};

const themeKeys = {
  all: ['mobile-theme'] as const,
};

export function useMobileTheme() {
  return useQuery<MobileThemeResponse>({
    queryKey: themeKeys.all,
    queryFn: () => api.get<MobileThemeResponse>('/v1/admin/mobile-theme'),
    staleTime: 30_000,
  });
}

export function useUpdateMobileTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (colors: ThemeColors) => api.put<{ colors: ThemeColors }>('/v1/admin/mobile-theme', colors),
    onSuccess: () => qc.invalidateQueries({ queryKey: themeKeys.all }),
  });
}

export function useResetMobileTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<MobileThemeResponse>('/v1/admin/mobile-theme/reset'),
    onSuccess: () => qc.invalidateQueries({ queryKey: themeKeys.all }),
  });
}
