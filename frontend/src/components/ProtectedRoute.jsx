import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './States'

export default function ProtectedRoute() {
  const { status, retry, logout } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <Spinner label="Signing you in…" className="min-h-screen" />
  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-medium">Could not reach the server.</p>
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={retry}>Try again</button>
          <button type="button" className="btn-secondary" onClick={logout}>Log out</button>
        </div>
      </div>
    )
  }
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/** Login/Register: send already-logged-in users to the dashboard. */
export function PublicOnlyRoute() {
  const { status } = useAuth()
  if (status === 'checking') return <Spinner label="Signing you in…" className="min-h-screen" />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
