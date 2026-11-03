import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Icon from './Icons'

const STUDENT_NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: 'home', end: true },
  { to: '/tasks', label: 'Tasks', short: 'Tasks', icon: 'tasks' },
  { to: '/planner', label: 'Planner', short: 'Plan', icon: 'planner' },
  { to: '/workload', label: 'Workload', short: 'Load', icon: 'workload' },
  { to: '/calendar', label: 'Calendar', short: 'Calendar', icon: 'calendar' },
  { to: '/classes', label: 'My classes', short: 'Classes', icon: 'classes' },
  { to: '/alerts', label: 'Alerts', short: 'Alerts', icon: 'alerts' },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: 'settings', desktopOnly: true },
]

const TEACHER_NAV = [
  { to: '/teacher', label: 'Dashboard', short: 'Home', icon: 'home', end: true },
  { to: '/teacher/classes', label: 'Classes', short: 'Classes', icon: 'classes' },
  { to: '/teacher/extensions', label: 'Extension requests', short: 'Requests', icon: 'inbox' },
]

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <circle cx="16" cy="16" r="5" fill="#4f46e5" />
        <ellipse cx="16" cy="16" rx="14" ry="6" fill="none" stroke="#4f46e5" strokeWidth="2.5" transform="rotate(-30 16 16)" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">Task Orbit</span>
    </div>
  )
}

/** Sidebar on desktop, bottom bar on phones (section 11). */
export default function Layout() {
  const { user, logout } = useAuth()
  const isTeacher = user?.role === 'teacher'
  const navItems = isTeacher ? TEACHER_NAV : STUDENT_NAV
  const mobileItems = navItems.filter((i) => !i.desktopOnly)

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 md:flex md:sticky md:top-0 md:h-screen">
        <div className="px-3">
          <Logo />
          <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            isTeacher ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
            {isTeacher ? 'Teacher' : 'Student'}
          </span>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Main">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}>
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-3 pt-4">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <button type="button" onClick={logout} className="btn-ghost mt-3 -ml-2 text-sm">
            <Icon name="logout" className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          {!isTeacher && (
            <NavLink to="/settings" className="btn-ghost" aria-label="Settings"><Icon name="settings" /></NavLink>
          )}
          <button type="button" onClick={logout} className="btn-ghost text-sm" aria-label="Log out">
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10 lg:px-10">
        <Outlet />
      </main>

      <nav aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
        {mobileItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? 'text-indigo-600' : 'text-slate-500'}`}>
            <Icon name={item.icon} className="h-5 w-5" />
            {item.short}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
