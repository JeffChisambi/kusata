import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/* Mirrors GET /v1/admin/points/* (admin-points.controller.ts). */

export interface PointsBreakdownRow {
  ruleKey: string;
  points: number;
  count: number;
}

export interface BoardRow {
  rank: number;
  userId: string;
  name: string;
  phone: string;
  email: string | null;
  joinedAt: string;
  totalPoints: number;
  lastAwardAt: string | null;
  breakdown: PointsBreakdownRow[];
  /** Set when one rule accounts for almost the whole score — what farming looks like. */
  suspicious: boolean;
}

export interface AdminBoardPage {
  season: { slug: string; name: string; endsAt: string; closed: boolean } | null;
  page: number;
  limit: number;
  total: number;
  rows: BoardRow[];
}

export interface PointEventRow {
  id: string;
  ruleKey: string;
  title: string;
  points: number;
  awardedOn: string;
  createdAt: string;
  dedupeKey: string;
  metadata: Record<string, unknown> | null;
}

export interface NotificationOpenRow {
  id: string;
  notificationId: string;
  latencyMs: number;
  awarded: boolean;
  rejectedReason: string | null;
  createdAt: string;
}

export interface AdminPointsUser {
  user: { id: string; name: string; firstName: string; lastName: string; phone: string; email: string | null; createdAt: string };
  season: { slug: string; name: string } | null;
  totalPoints: number;
  rank: number | null;
  lastAwardAt: string | null;
  breakdown: PointsBreakdownRow[];
  suspicious: boolean;
  events: PointEventRow[];
  notificationOpens: NotificationOpenRow[];
  lessons: Array<{ lessonId: string; completedAt: string }>;
}

export function useAdminBoard(filters: { page?: number; limit?: number; search?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery<AdminBoardPage>({
    queryKey: ['admin', 'points', 'board', filters],
    queryFn: () => api.get<AdminBoardPage>(`/v1/admin/points/leaderboard${qs ? `?${qs}` : ''}`),
    placeholderData: (prev) => prev,
  });
}

export function useAdminPointsUser(userId: string | null) {
  return useQuery<AdminPointsUser>({
    queryKey: ['admin', 'points', 'user', userId],
    queryFn: () => api.get<AdminPointsUser>(`/v1/admin/points/users/${userId}`),
    enabled: Boolean(userId),
  });
}
