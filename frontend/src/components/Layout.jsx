import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Icon from './Icons'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

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

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
}

/** Sidebar on desktop, bottom bar on phones (section 11). */
export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const isTeacher = user?.role === 'teacher'
  // A new page starts at the top (the layout stays mounted, so the browser wouldn't reset it).
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  const navItems = isTeacher ? TEACHER_NAV : STUDENT_NAV
  const mobileItems = navItems.filter((i) => !i.desktopOnly)
  const tone = isTeacher ? 'emerald' : 'indigo'
  const activePill = isTeacher
    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 before:bg-emerald-500'
    : 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 before:bg-indigo-500'
  const avatar = isTeacher ? 'from-emerald-500 to-teal-500' : 'from-indigo-500 to-fuchsia-500'

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/80 bg-surface/80 px-3 py-5 backdrop-blur-xl md:sticky md:top-0 md:flex md:h-screen">
        <div className="px-3">
          <Logo tone={tone} />
        </div>
        <nav className="stagger mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200
                before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:transition-all ${
                  isActive ? `${activePill} font-semibold before:opacity-100`
                    : 'text-slate-600 before:opacity-0 hover:translate-x-0.5 hover:bg-slate-100/80 hover:text-slate-900'
                }`}>
              <Icon name={item.icon} className="h-5 w-5 transition-transform group-hover:scale-110" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatar} text-sm font-bold text-white shadow-md`}>
              {initials(user?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isTeacher ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                <Icon name={isTeacher ? 'teacher' : 'student'} className="h-3 w-3" />
                {isTeacher ? 'Teacher' : 'Student'}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={logout} className="btn-ghost -ml-1 text-sm hover:text-red-600">
              <Icon name="logout" className="h-4 w-4" /> Log out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-surface/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <Logo tone={tone} />
        <div className="flex items-center gap-1">
          <ThemeToggle className="mr-1" />
          {!isTeacher && (
            <NavLink to="/settings" className="btn-ghost" aria-label="Settings"><Icon name="settings" /></NavLink>
          )}
          <button type="button" onClick={logout} className="btn-ghost text-sm" aria-label="Log out">
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-10 md:pt-8 lg:px-10">
        {/* Keyed by path, so each page fades up when you navigate to it. */}
        <div key={location.pathname} className="animate-fade-up">
          <Outlet />
        </div>
      </main>

      <nav aria-label="Main"
        className="fixed inset-x-3 bottom-3 z-30 grid rounded-2xl border border-slate-200/80 bg-surface/90 p-1 pb-[max(.25rem,env(safe-area-inset-bottom))] shadow-xl shadow-slate-900/10 backdrop-blur-xl md:hidden"
        style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
        {mobileItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition duration-200 ${isActive
                ? (isTeacher ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700')
                : 'text-slate-500 active:scale-95'}`}>
            {({ isActive }) => (
              <>
                <Icon name={item.icon} className={`h-5 w-5 transition-transform duration-300 ${isActive ? '-translate-y-0.5 scale-110' : ''}`} />
                {item.short}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
