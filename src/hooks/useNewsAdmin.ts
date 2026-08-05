import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NewsArticle = {
  id: string;
  category: string;
  title: string;
  summary: string | null;
  body: string[];
  source: string;
  imageUrl: string | null;
  featured: boolean;
  isPublished: boolean;
  publishedAt: string;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewsListResponse = {
  articles: NewsArticle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type NewsInput = {
  category: string;
  title: string;
  summary?: string;
  body: string[];
  source: string;
  imageUrl?: string;
  featured?: boolean;
  isPublished?: boolean;
  publishedAt?: string;
};

// ── Query keys ────────────────────────────────────────────────────────────────

const newsKeys = {
  all: ['news-admin'] as const,
  list: () => [...newsKeys.all, 'list'] as const,
  detail: (id: string) => [...newsKeys.all, 'detail', id] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useNewsList() {
  return useQuery<NewsListResponse>({
    queryKey: newsKeys.list(),
    queryFn: () => api.get<NewsListResponse>('/v1/admin/news?limit=100'),
    staleTime: 15_000,
  });
}

export function useCreateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewsInput) => api.post<NewsArticle>('/v1/admin/news', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: newsKeys.all }),
  });
}

export function useUpdateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<NewsInput> }) =>
      api.patch<NewsArticle>(`/v1/admin/news/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: newsKeys.all }),
  });
}

export function useDeleteNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/v1/admin/news/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: newsKeys.all }),
  });
}
