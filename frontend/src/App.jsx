import { Link, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute'
import WakeUpBanner from './components/WakeUpBanner'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import DashboardPage from './pages/DashboardPage'
import { AlertsPage, CalendarPage, PlannerPage, WorkloadPage } from './pages/PlaceholderPages'
import SettingsPage from './pages/SettingsPage'
import TasksPage from './pages/TasksPage'

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-lg font-semibold">Page not found</p>
      <Link to="/" className="btn-primary mt-4">Back to dashboard</Link>
    </div>
  )
}

export default function App() {
  return (
    <>
      <WakeUpBanner />
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/workload" element={<WorkloadPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
