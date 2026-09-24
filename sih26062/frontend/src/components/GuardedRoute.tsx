import { Navigate } from 'react-router-dom';

import { loadAuth } from '../state/auth';

export default function GuardedRoute({
  children,
}: {
  children: any;
}) {
  const auth = loadAuth();
  if (!auth?.token) return <Navigate to="/login" replace />;
  return children;
}
