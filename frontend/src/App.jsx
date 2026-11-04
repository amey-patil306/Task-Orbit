import { lazy, Suspense, useEffect } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute'
import { Spinner } from './components/States'
import WakeUpBanner from './components/WakeUpBanner'
import { homeFor, useAuth } from './context/AuthContext'
import AlertsPage from './pages/AlertsPage'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import ClassesPage from './pages/ClassesPage'
import DashboardPage from './pages/DashboardPage'
import PlannerPage from './pages/PlannerPage'
import SettingsPage from './pages/SettingsPage'
import TasksPage from './pages/TasksPage'
import TeacherClassesPage from './pages/teacher/TeacherClassesPage'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import ExtensionInboxPage from './pages/teacher/ExtensionInboxPage'

// Calendar and chart pages pull in heavy libraries; load them only when opened.
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const WorkloadPage = lazy(() => import('./pages/WorkloadPage'))
const ClassDetailPage = lazy(() => import('./pages/teacher/ClassDetailPage'))
const AssignmentDetailPage = lazy(() => import('./pages/teacher/AssignmentDetailPage'))
const page = (Component) => <Suspense fallback={<Spinner />}><Component /></Suspense>

function NotFound() {
  const { user } = useAuth()
  useEffect(() => { document.title = 'Page not found · Task Orbit' }, [])
  return (
    <div className="flex flex-col items-center py-16 text-center">
      {/* A planet that drifted out of orbit */}
      <div className="relative h-40 w-40">
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-slate-300" />
        <div className="absolute inset-6 rounded-full border border-dashed border-slate-200" />
        <div className="absolute inset-[38%] rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/40" />
        <div className="absolute -right-6 -top-2 h-6 w-6 animate-float rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg shadow-orange-500/40" />
      </div>
      <p className="mt-6 text-6xl font-extrabold tracking-tight text-gradient">404</p>
      <p className="mt-2 text-lg font-semibold">This page drifted out of orbit</p>
      <p className="mt-1 text-sm text-slate-500">The link may be old, or the page was moved.</p>
      <Link to={homeFor(user)} className="btn-primary mt-6">Back to dashboard</Link>
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
            {/* Student app */}
            <Route element={<ProtectedRoute role="student" />}>
              <Route index element={<DashboardPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/calendar" element={page(CalendarPage)} />
              <Route path="/workload" element={page(WorkloadPage)} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Teacher app */}
            <Route element={<ProtectedRoute role="teacher" />}>
              <Route path="/teacher" element={<TeacherDashboard />} />
              <Route path="/teacher/classes" element={<TeacherClassesPage />} />
              <Route path="/teacher/classes/:id" element={page(ClassDetailPage)} />
              <Route path="/teacher/assignments/:id" element={page(AssignmentDetailPage)} />
              <Route path="/teacher/extensions" element={<ExtensionInboxPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
