// ═══════════════════════════════════════════════════════════════════════════
// CSRF Token Hook
// Manages CSRF token fetching and provides helpers for protected requests
// ═══════════════════════════════════════════════════════════════════════════

import * as React from "react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface CsrfTokenData {
  token: string;
  headerName: string;
  expires: string;
}

interface UseCsrfReturn {
  /** The current CSRF token */
  token: string | null;
  /** Whether the token is being fetched */
  isLoading: boolean;
  /** Error message if token fetch failed */
  error: string | null;
  /** Refresh the CSRF token */
  refresh: () => Promise<void>;
  /** Get headers object with CSRF token included */
  getHeaders: (additionalHeaders?: HeadersInit) => HeadersInit;
  /** Make a protected fetch request with CSRF token */
  protectedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

// ─────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Hook to manage CSRF tokens for protected requests
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { protectedFetch, isLoading } = useCsrf();
 *
 *   const handleSubmit = async () => {
 *     const res = await protectedFetch('/api/some-endpoint', {
 *       method: 'POST',
 *       body: JSON.stringify({ data: 'value' }),
 *     });
 *   };
 * }
 * ```
 */
export function useCsrf(): UseCsrfReturn {
  const [token, setToken] = React.useState<string | null>(null);
  const [headerName, setHeaderName] = React.useState<string>("x-csrf-token");
  // Start as true since we fetch token on mount - prevents actions before token is ready
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch CSRF token on mount
  const fetchToken = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/csrf");

      if (!res.ok) {
        throw new Error("Failed to fetch CSRF token");
      }

      const data: CsrfTokenData = await res.json();
      setToken(data.token);
      setHeaderName(data.headerName);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[useCsrf] Failed to fetch token:", message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch token on mount
  React.useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Get headers with CSRF token
  const getHeaders = React.useCallback(
    (additionalHeaders?: HeadersInit): HeadersInit => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers[headerName] = token;
      }

      if (additionalHeaders) {
        if (additionalHeaders instanceof Headers) {
          additionalHeaders.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(additionalHeaders)) {
          additionalHeaders.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, additionalHeaders);
        }
      }

      return headers;
    },
    [token, headerName]
  );

  // Protected fetch that includes CSRF token
  const protectedFetch = React.useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = getHeaders(options.headers);

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [getHeaders]
  );

  return {
    token,
    isLoading,
    error,
    refresh: fetchToken,
    getHeaders,
    protectedFetch,
  };
}
