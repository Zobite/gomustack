import { type ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { client } from "src/lib/client";
import { useAuthStore } from "../stores/auth.store";
import LoadingScreen from "./LoadingScreen";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuthStore(useShallow((s) => ({ isAuthenticated: s.isAuthenticated, loading: s.loading })));
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !loading) {
      client.auth.setupStatus().then((res) => setNeedsSetup(res.needsSetup)).catch(() => setNeedsSetup(false));
    }
  }, [isAuthenticated, loading]);

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    // Still checking setup status
    if (needsSetup === null) return <LoadingScreen />;
    // Redirect to setup if no users exist
    if (needsSetup) return <Navigate to="/setup" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function GuestGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuthStore(useShallow((s) => ({ isAuthenticated: s.isAuthenticated, loading: s.loading })));

  if (loading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}
