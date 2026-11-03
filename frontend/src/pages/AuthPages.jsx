import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage, fieldErrors } from '../api/client'
import { useAuth } from '../context/AuthContext'

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-slate-50 to-white px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <svg viewBox="0 0 32 32" className="h-12 w-12" aria-hidden="true">
            <circle cx="16" cy="16" r="5" fill="#4f46e5" />
            <ellipse cx="16" cy="16" rx="14" ry="6" fill="none" stroke="#4f46e5" strokeWidth="2.5" transform="rotate(-30 16 16)" />
          </svg>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="card">{children}</div>
        <p className="mt-4 text-center text-sm text-slate-600">{footer}</p>
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

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm()
  const showServerErrors = useServerErrors(setError)

  const onSubmit = async (values) => {
    try {
      await login(values)
      navigate(location.state?.from?.pathname ?? '/', { replace: true })
    } catch (err) {
      showServerErrors(err, ['email', 'password'])
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see this week's workload"
      footer={<>New here? <Link to="/register" className="font-medium text-indigo-600 hover:underline">Create an account</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {errors.root && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors.root.message}</p>}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className={`input ${errors.email ? 'input-error' : ''}`}
            {...register('email', EMAIL_RULES)} />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" className={`input ${errors.password ? 'input-error' : ''}`}
            {...register('password', { required: 'Enter your password' })} />
          {errors.password && <p className="field-error">{errors.password.message}</p>}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthShell>
  )
}

export function RegisterPage() {
  const { register: signUp } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm()
  const showServerErrors = useServerErrors(setError)

  const onSubmit = async ({ confirm, ...values }) => {
    try {
      await signUp(values)
      navigate('/settings', { replace: true, state: { welcome: true } })
    } catch (err) {
      showServerErrors(err, ['name', 'email', 'password'])
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Predict overload before it happens"
      footer={<>Already have an account? <Link to="/login" className="font-medium text-indigo-600 hover:underline">Log in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {errors.root && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors.root.message}</p>}
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" autoComplete="name" className={`input ${errors.name ? 'input-error' : ''}`}
            {...register('name', { required: 'Enter your name', maxLength: { value: 100, message: 'Too long' } })} />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className={`input ${errors.email ? 'input-error' : ''}`}
            {...register('email', EMAIL_RULES)} />
          {errors.email && <p className="field-error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" className={`input ${errors.password ? 'input-error' : ''}`}
            {...register('password', { required: 'Choose a password', minLength: { value: 8, message: 'Use at least 8 characters' } })} />
          {errors.password && <p className="field-error">{errors.password.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" autoComplete="new-password" className={`input ${errors.confirm ? 'input-error' : ''}`}
            {...register('confirm', { validate: (v, all) => v === all.password || 'Passwords do not match' })} />
          {errors.confirm && <p className="field-error">{errors.confirm.message}</p>}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
