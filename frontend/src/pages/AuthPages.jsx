import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage, fieldErrors } from '../api/client'
import Icon from '../components/Icons'
import { OrbitMark } from '../components/Logo'
import OrbitScene from '../components/OrbitScene'
import ThemeToggle from '../components/ThemeToggle'
import { homeFor, useAuth } from '../context/AuthContext'

// One-click demo logins for the viva (accounts created by scripts/seed.py).
// Hide them on a real deployment with VITE_SHOW_DEMO=false.
const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO !== 'false'
const DEMO = {
  student: { email: 'demo@taskorbit.in', password: 'demo12345' },
  teacher: { email: 'teacher@taskorbit.in', password: 'demo12345' },
}

/** Accent colours follow the selected role: indigo for students, emerald for teachers. */
const ACCENT = {
  student: { button: '', ring: 'focus:border-indigo-500 focus:ring-indigo-500/15', text: 'text-indigo-600', tone: 'indigo' },
  teacher: {
    button: 'from-emerald-600 to-teal-600 shadow-emerald-500/30 hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-500/30 focus-visible:ring-emerald-500',
    ring: 'focus:border-emerald-500 focus:ring-emerald-500/15', text: 'text-emerald-600', tone: 'emerald',
  },
}

function AuthShell({ role, title, subtitle, children, footer, shake, onShakeEnd }) {
  const accent = ACCENT[role] ?? ACCENT.student
  useEffect(() => { document.title = `${title} · Task Orbit` }, [title])
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1.15fr_1fr]">
      <div className="sticky top-0 hidden h-screen lg:block">
        <OrbitScene role={role} />
      </div>

      <div className="relative flex flex-col">
        <div className="absolute right-4 top-4 z-10"><ThemeToggle /></div>
        {/* Phones and tablets: a compact orbit banner instead of the full scene */}
        <div className="h-48 lg:hidden"><OrbitScene role={role} compact /></div>

        <div className="relative -mt-8 flex flex-1 items-start justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:py-12">
          <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(40rem_30rem_at_80%_0%,rgb(99_102_241/0.08),transparent),radial-gradient(30rem_25rem_at_0%_100%,rgb(16_185_129/0.06),transparent)] lg:block" />
          <div className="relative w-full max-w-md animate-fade-up">
            <div className="mb-6 flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="flex items-center gap-2 rounded-2xl bg-surface p-2 shadow-lg shadow-slate-900/5 lg:bg-transparent lg:p-0 lg:shadow-none">
                <OrbitMark className="h-10 w-10" tone={accent.tone} />
                <span className="hidden text-xl font-extrabold tracking-tight lg:inline">Task Orbit</span>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{title}</h1>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            <div className={`card p-6 shadow-xl shadow-slate-900/5 sm:p-8 ${shake ? 'animate-shake' : ''}`}
              onAnimationEnd={(e) => e.target === e.currentTarget && onShakeEnd?.()}>
              {children}
            </div>
            <p className="mt-5 text-center text-sm text-slate-600">{footer}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function useServerErrors(setError) {
  return (err, known) => {
    const fields = fieldErrors(err)
    let mapped = false
    for (const [name, message] of Object.entries(fields)) {
      if (known.includes(name)) {
        setError(name, { message })
        mapped = true
      }
    }
    if (!mapped) setError('root', { message: errorMessage(err) })
  }
}

const EMAIL_RULES = {
  required: 'Enter your email',
  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
}

function FormError({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="flex animate-fade-in items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
      <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />{message}
    </p>
  )
}

/** Password input with show/hide and a Caps Lock warning. `field` is react-hook-form's register(...) result. */
function PasswordInput({ id, field, error, autoComplete, accent }) {
  const [visible, setVisible] = useState(false)
  const [caps, setCaps] = useState(false)
  const checkCaps = (e) => setCaps(Boolean(e.getModifierState?.('CapsLock')))
  return (
    <>
      <div className="relative">
        <input id={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete}
          className={`input pr-10 ${accent.ring} ${error ? 'input-error' : ''}`}
          {...field} onKeyUp={checkCaps} onKeyDown={checkCaps}
          onBlur={(e) => { setCaps(false); field.onBlur(e) }} />
        <button type="button" onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-400 transition hover:text-slate-700"
          aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
          <Icon name={visible ? 'eyeOff' : 'eye'} className="h-4 w-4" />
        </button>
      </div>
      {caps && <p className="mt-1 flex animate-fade-in items-center gap-1 text-xs text-amber-700"><Icon name="warning" className="h-3.5 w-3.5" /> Caps Lock is on</p>}
    </>
  )
}

function SubmitButton({ busy, busyLabel, label, accent }) {
  return (
    <button type="submit" className={`btn-primary group w-full py-2.5 ${accent.button}`} disabled={busy}>
      {busy ? (
        <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />{busyLabel}</>
      ) : (
        <>{label}<Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
      )}
    </button>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [shake, setShake] = useState(false)
  const { register, handleSubmit, setError, setValue, clearErrors, watch, formState: { errors, isSubmitting } } = useForm({
    // Coming back from a teacher page? Pre-select "Teacher".
    defaultValues: { role: location.state?.from?.pathname?.startsWith('/teacher') ? 'teacher' : 'student' },
  })
  const showServerErrors = useServerErrors(setError)
  const role = watch('role')
  const accent = ACCENT[role] ?? ACCENT.student

  const onSubmit = async (values) => {
    try {
      const user = await login(values)
      const from = location.state?.from?.pathname
      // Only return to the previous page if it belongs to this role's part of the app.
      const sameArea = from && from.startsWith('/teacher') === (user.role === 'teacher')
      navigate(sameArea ? from : homeFor(user), { replace: true })
    } catch (err) {
      setShake(true)
      // A role mismatch reads better as one message at the top than under the dropdown.
      if (err?.response?.data?.error?.code === 'wrong_role') setError('root', { message: errorMessage(err) })
      else showServerErrors(err, ['email', 'password', 'role'])
    }
  }

  const fillDemo = (r) => {
    clearErrors()
    setValue('role', r)
    setValue('email', DEMO[r].email, { shouldValidate: true })
    setValue('password', DEMO[r].password, { shouldValidate: true })
  }

  return (
    <AuthShell role={role} shake={shake} onShakeEnd={() => setShake(false)}
      title="Welcome back" subtitle={role === 'teacher' ? 'Log in to see your classes at a glance' : "Log in to see this week's workload"}
      footer={<>New here? <Link to="/register" className={`font-semibold hover:underline ${accent.text}`}>Create an account</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormError message={errors.root?.message} />
        <div>
          <label className="label" htmlFor="role">Log in as</label>
          <div className="relative">
            <span key={role} className={`pointer-events-none absolute inset-y-0 left-0 flex w-10 animate-pop items-center justify-center ${accent.text}`}>
              <Icon name={role === 'teacher' ? 'teacher' : 'student'} className="h-5 w-5" />
            </span>
            <select id="role" className={`input cursor-pointer appearance-none pl-10 pr-10 font-medium ${accent.ring} ${errors.role ? 'input-error' : ''}`}
              {...register('role')}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
            <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          {errors.role && <p className="field-error">{errors.role.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" placeholder="you@college.edu"
            className={`input ${accent.ring} ${errors.email ? 'input-error' : ''}`}
            {...register('email', EMAIL_RULES)} />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="current-password" accent={accent} error={errors.password}
            field={register('password', { required: 'Enter your password' })} />
          {errors.password && <p className="field-error">{errors.password.message}</p>}
        </div>
        <SubmitButton busy={isSubmitting} label={`Log in as ${role === 'teacher' ? 'teacher' : 'student'}`} busyLabel="Logging in…" accent={accent} />
      </form>

      {SHOW_DEMO && (
        <div className="mt-6">
          <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />Try a demo account<span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[['student', 'Student demo', 'hover:border-indigo-300 hover:bg-indigo-50/60', 'text-indigo-600'],
              ['teacher', 'Teacher demo', 'hover:border-emerald-300 hover:bg-emerald-50/60', 'text-emerald-600']].map(([r, label, hover, tint]) => (
              <button key={r} type="button" onClick={() => fillDemo(r)}
                className={`group flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm transition active:scale-[.98] ${hover}`}>
                <Icon name={r} className={`h-5 w-5 transition-transform group-hover:-rotate-6 group-hover:scale-110 ${tint}`} />
                <span>
                  <span className="block font-semibold text-slate-800">{label}</span>
                  <span className="block text-[11px] text-slate-500">Fills the form</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  )
}

/** 0-4 score from length and character variety; shown as a 4-bar meter. */
function passwordStrength(pw = '') {
  if (!pw) return 0
  const checks = [pw.length >= 8, pw.length >= 12, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)]
  return Math.min(4, Math.max(1, checks.filter(Boolean).length - (pw.length < 8 ? 1 : 0)))
}
const STRENGTH = [
  null,
  { label: 'Weak', bar: 'bg-red-500', text: 'text-red-600' },
  { label: 'Okay', bar: 'bg-amber-500', text: 'text-amber-600' },
  { label: 'Good', bar: 'bg-lime-500', text: 'text-lime-700' },
  { label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-600' },
]

function StrengthMeter({ password }) {
  const score = passwordStrength(password)
  if (!password) return null
  const s = STRENGTH[score]
  return (
    <div className="mt-2 flex animate-fade-in items-center gap-2">
      <div className="grid flex-1 grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`h-1.5 rounded-full transition-all duration-300 ${n <= score ? s.bar : 'bg-slate-200'}`} />
        ))}
      </div>
      <span className={`w-12 text-right text-xs font-medium ${s.text}`}>{s.label}</span>
    </div>
  )
}

export function RegisterPage() {
  const { register: signUp } = useAuth()
  const navigate = useNavigate()
  const [shake, setShake] = useState(false)
  const { register, handleSubmit, setError, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { role: 'student' },
  })
  const showServerErrors = useServerErrors(setError)
  const role = watch('role')
  const password = watch('password')
  const accent = ACCENT[role] ?? ACCENT.student

  const onSubmit = async ({ confirm, ...values }) => {
    if (values.role === 'student') delete values.teacher_code
    try {
      const user = await signUp(values)
      if (user.role === 'teacher') navigate('/teacher', { replace: true, state: { welcome: true } })
      else navigate('/classes', { replace: true, state: { welcome: true } })
    } catch (err) {
      setShake(true)
      showServerErrors(err, ['name', 'email', 'password', 'teacher_code'])
    }
  }

  return (
    <AuthShell role={role} shake={shake} onShakeEnd={() => setShake(false)}
      title="Create your account" subtitle="Balance workload across every subject"
      footer={<>Already have an account? <Link to="/login" className={`font-semibold hover:underline ${accent.text}`}>Log in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormError message={errors.root?.message} />
        <div>
          <span className="label">I am a</span>
          <input type="hidden" {...register('role')} />
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
            {[['student', 'Student', 'Track my workload', 'border-indigo-500 bg-indigo-50/70 ring-indigo-500', 'text-indigo-600'],
              ['teacher', 'Teacher', 'Manage my classes', 'border-emerald-500 bg-emerald-50/70 ring-emerald-500', 'text-emerald-600']]
              .map(([value, label, hint, active, tint]) => {
                const on = role === value
                return (
                  <button key={value} type="button" role="radio" aria-checked={on}
                    onClick={() => setValue('role', value)}
                    className={`relative rounded-xl border p-3 text-left transition duration-200 active:scale-[.98] ${on
                      ? `${active} ring-1 shadow-sm` : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm'}`}>
                    <Icon name={value} className={`h-6 w-6 transition ${on ? `${tint} scale-110` : 'text-slate-400'}`} />
                    <span className="mt-2 block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                    {on && (
                      <span className={`absolute right-2 top-2 flex h-5 w-5 animate-pop items-center justify-center rounded-full text-white ${value === 'teacher' ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
                        <Icon name="check" className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                )
              })}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" autoComplete="name" className={`input ${accent.ring} ${errors.name ? 'input-error' : ''}`}
            {...register('name', { required: 'Enter your name', maxLength: { value: 100, message: 'Too long' } })} />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" placeholder="you@college.edu"
            className={`input ${accent.ring} ${errors.email ? 'input-error' : ''}`}
            {...register('email', EMAIL_RULES)} />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="new-password" accent={accent} error={errors.password}
            field={register('password', { required: 'Choose a password', minLength: { value: 8, message: 'Use at least 8 characters' } })} />
          {errors.password ? <p className="field-error">{errors.password.message}</p> : <StrengthMeter password={password} />}
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <PasswordInput id="confirm" autoComplete="new-password" accent={accent} error={errors.confirm}
            field={register('confirm', { validate: (v, all) => v === all.password || 'Passwords do not match' })} />
          {errors.confirm && <p className="field-error">{errors.confirm.message}</p>}
        </div>
        {role === 'teacher' ? (
          <div key="teacher" className="animate-fade-up">
            <label className="label" htmlFor="teacher_code">Teacher signup code</label>
            <input id="teacher_code" className={`input ${accent.ring} ${errors.teacher_code ? 'input-error' : ''}`} autoComplete="off"
              {...register('teacher_code', { required: 'Enter the code from your department' })} />
            {errors.teacher_code
              ? <p className="field-error">{errors.teacher_code.message}</p>
              : <p className="mt-1 text-xs text-slate-500">Given to faculty by the department, so students can't sign up as teachers.</p>}
          </div>
        ) : (
          <div key="student" className="grid animate-fade-up grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="year">Year <span className="font-normal text-slate-400">(optional)</span></label>
              <select id="year" className={`input ${accent.ring}`} {...register('year')}>
                <option value="">—</option>
                {['FE', 'SE', 'TE', 'BE'].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="division">Division <span className="font-normal text-slate-400">(optional)</span></label>
              <input id="division" className={`input ${accent.ring}`} maxLength={20} placeholder="A" {...register('division')} />
            </div>
          </div>
        )}
        <SubmitButton busy={isSubmitting} label="Create account" busyLabel="Creating account…" accent={accent} />
      </form>
    </AuthShell>
  )
}
