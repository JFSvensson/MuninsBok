import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wrapper that redirects unauthenticated users to /login.
 * While the auth state is still loading (e.g. refreshing tokens)
 * a loading indicator is shown.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Laddar…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
