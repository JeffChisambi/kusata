/**
 * Pine Admin API Client
 *
 * Wraps fetch with:
 *   - Base URL configuration (VITE_API_URL)
 *   - Auto-attach Authorization header
 *   - 401 → token refresh → retry once → redirect to login
 *
 * Fix: token refresh is deduplicated behind a single in-flight promise so
 * concurrent 401s don't race and log the user out spuriously.
 */

import { navigateTo } from './nav-registry';

const _configuredUrl = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL;
if (!_configuredUrl) {
  console.error('[Pine API] VITE_API_URL is not set. All API requests will fail. Add it to your .env file.');
}
const BASE_URL: string = _configuredUrl || '';

class ApiClient {
  /** In-flight refresh promise — shared across all concurrent requests. */
  private _refreshPromise: Promise<boolean> | null = null;

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('pine_admin_access_token');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { skipAuth?: boolean },
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!options?.skipAuth) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const url = `${BASE_URL}/${path.replace(/^\//, '')}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 401 — try refresh (deduplicated), then redirect to login
    if (res.status === 401 && !options?.skipAuth) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        // Retry the original request with the new token
        headers['Authorization'] = `Bearer ${this.getToken()}`;
        const retryRes = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (retryRes.ok) {
          const retryJson = await retryRes.json();
          return retryJson?.data !== undefined ? retryJson.data : retryJson;
        }
      }

      // Refresh failed — clear tokens and navigate to login via the router
      this.clearTokens();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        navigateTo('/login');
      }
      throw new ApiError(401, 'Session expired. Please log in again.');
    }

    if (!res.ok) {
      let errorData: any = {};
      try {
        errorData = await res.json();
      } catch {
        // non-JSON error response
      }
      throw new ApiError(
        res.status,
        errorData?.message || `Request failed: ${res.status}`,
        errorData?.code,
      );
    }

    // Handle 204 No Content
    if (res.status === 204) {
      return {} as T;
    }

    const json = await res.json();
    // Unwrap the backend's response envelope: { success, data, meta }
    return json?.data !== undefined ? json.data : json;
  }

  /**
   * Deduplicates concurrent refresh attempts behind a single promise.
   * If a refresh is already in flight, all callers await the same one.
   */
  private async tryRefresh(): Promise<boolean> {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    this._refreshPromise = this._doRefresh().finally(() => {
      this._refreshPromise = null;
    });

    return this._refreshPromise;
  }

  private async _doRefresh(): Promise<boolean> {
    const refreshToken = typeof window !== 'undefined'
      ? localStorage.getItem('pine_admin_refresh_token')
      : null;

    if (!refreshToken) return false;

    try {
      const res = await fetch(`${BASE_URL}/v1/admin/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem('pine_admin_access_token', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('pine_admin_refresh_token', data.refreshToken);
        }
        return true;
      }
    } catch {
      // Refresh failed — caller will handle redirect
    }

    return false;
  }

  private clearTokens() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('pine_admin_access_token');
    localStorage.removeItem('pine_admin_refresh_token');
    localStorage.removeItem('pine_admin_user');
  }

  // ── HTTP Methods ─────────────────────────────────────────────

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /**
   * Authenticated binary download (e.g. generated PDFs). Mirrors request()'s
   * auth + single-refresh-retry behaviour but returns the raw Blob.
   */
  async getBlob(path: string): Promise<Blob> {
    const url = `${BASE_URL}/${path.replace(/^\//, '')}`;
    const doFetch = () =>
      fetch(url, {
        headers: this.getToken()
          ? { Authorization: `Bearer ${this.getToken()}` }
          : {},
      });

    let res = await doFetch();
    if (res.status === 401) {
      const refreshed = await this.tryRefresh();
      if (refreshed) res = await doFetch();
    }
    if (!res.ok) {
      throw new ApiError(res.status, `Download failed: ${res.status}`);
    }
    return res.blob();
  }

  async post<T>(path: string, body?: unknown, options?: { skipAuth?: boolean }): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient();
