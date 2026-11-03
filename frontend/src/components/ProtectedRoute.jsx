import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { homeFor, useAuth } from '../context/AuthContext'
import { Spinner } from './States'

/** Logged-in users only; with `role`, also sends the other role back to its own home. */
export default function ProtectedRoute({ role }) {
  const { status, user, retry, logout } = useAuth()
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
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

/** Login/Register: send already-logged-in users to their dashboard. */
export function PublicOnlyRoute() {
  const { status, user } = useAuth()
  if (status === 'checking') return <Spinner label="Signing you in…" className="min-h-screen" />
  if (status === 'authenticated') return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}
