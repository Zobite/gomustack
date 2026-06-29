import { useEffect, useRef } from "react";
import { client } from "src/lib/client";
import { GomuStackError } from "src/lib/http";
import { useAuthStore } from "../stores/auth.store";

/** Interval to check token refresh (10 minutes) */
const REFRESH_CHECK_INTERVAL = 10 * 60 * 1000;

function is401(err: unknown): boolean {
  return err instanceof GomuStackError && err.status === 401;
}

/**
 * Auth init flow:
 *   me() → OK → setUser
 *   me() → 401 → refresh() → me() → OK → setUser
 *   me() → 401 → refresh() → 401 → clearTokens + logout
 *   me() → any other error → ignore (keep tokens, stop loading)
 */
export function useAuthInit() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const logout = useAuthStore((s) => s.logout);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!client.accessToken) {
      // No token → clear any persisted auth state and stop loading
      logout();
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const user = await client.auth.me();
        if (!cancelled) setUser(user);
      } catch (err) {
        if (!is401(err)) {
          // Network error, 500, etc. → ignore, keep tokens
          if (!cancelled) setLoading(false);
          return;
        }

        // 401 → try refresh
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) {
          if (!cancelled) clearTokensAndLogout();
          return;
        }

        try {
          await client.auth.refresh(refreshToken);
          const user = await client.auth.me();
          if (!cancelled) setUser(user);
        } catch (refreshErr) {
          if (is401(refreshErr)) {
            if (!cancelled) clearTokensAndLogout();
          } else {
            // refresh failed for non-401 reason → ignore
            if (!cancelled) setLoading(false);
          }
        }
      }
    })();

    // Periodic refresh
    refreshTimerRef.current = setInterval(() => {
      const rt = localStorage.getItem("refresh_token");
      if (rt) {
        client.auth.refresh(rt).catch((err) => {
          if (is401(err)) clearTokensAndLogout();
        });
      }
    }, REFRESH_CHECK_INTERVAL);

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };

    function clearTokensAndLogout() {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("auth-storage");
      logout();
    }
  }, [setUser, setLoading, logout]);
}
