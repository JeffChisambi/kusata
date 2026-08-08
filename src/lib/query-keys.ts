/**
 * TanStack Query key factory for consistent cache management.
 */
export const queryKeys = {
  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    charts: (days?: number) => [...queryKeys.dashboard.all, 'charts', days] as const,
    health: () => [...queryKeys.dashboard.all, 'health'] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
    list: (filters?: object) => [...queryKeys.users.all, 'list', filters] as const,
    workspace: (userId: string) => [...queryKeys.users.all, 'workspace', userId] as const,
    devices: (userId: string) => [...queryKeys.users.all, 'devices', userId] as const,
    sessions: (userId: string) => [...queryKeys.users.all, 'sessions', userId] as const,
  },

  // KYC
  kyc: {
    all: ['kyc'] as const,
    queue: (filters?: Record<string, unknown>) => [...queryKeys.kyc.all, 'queue', filters] as const,
    application: (id: string) => [...queryKeys.kyc.all, 'application', id] as const,
    /** Resolved CSD form field values (reconciled + broker overrides). */
    csdData: (id: string) => [...queryKeys.kyc.all, 'csd-data', id] as const,
    /** Counts per status — drives tab badges and stats cards. Requires GET /v1/admin/kyc/counts */
    counts: () => [...queryKeys.kyc.all, 'counts'] as const,
  },

  // Trading
  trading: {
    all: ['trading'] as const,
    orders: (filters?: Record<string, unknown>) => [...queryKeys.trading.all, 'orders', filters] as const,
    order: (id: string) => [...queryKeys.trading.all, 'order', id] as const,
  },

  // Wallets
  wallets: {
    all: ['wallets'] as const,
    list: (filters?: object) => [...queryKeys.wallets.all, 'list', filters] as const,
    detail: (userId: string) => [...queryKeys.wallets.all, 'detail', userId] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    list: (filters?: object) => [...queryKeys.notifications.all, 'list', filters] as const,
    stats: () => [...queryKeys.notifications.all, 'stats'] as const,
  },

  // Support tickets
  support: {
    all: ['support'] as const,
    list: (filters?: object) => [...queryKeys.support.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.support.all, 'detail', id] as const,
    stats: () => [...queryKeys.support.all, 'stats'] as const,
  },

  // Audit
  audit: {
    all: ['audit'] as const,
    search: (filters?: Record<string, unknown>) => [...queryKeys.audit.all, 'search', filters] as const,
  },

  // Current admin user (me)
  me: {
    all: ['me'] as const,
    profile: () => [...queryKeys.me.all, 'profile'] as const,
    sessions: () => [...queryKeys.me.all, 'sessions'] as const,
    notifPrefs: () => [...queryKeys.me.all, 'notif-prefs'] as const,
  },
};
