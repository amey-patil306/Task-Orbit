import { useEffect, useState } from 'react'

// 'light' | 'dark' | 'system'. index.html applies the saved choice before first paint (no flash).
const KEY = 'task-orbit-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function read() {
  try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' }
}

function apply(choice) {
  const dark = choice === 'dark' || (choice === 'system' && media().matches)
  const root = document.documentElement
  root.classList.add('theme-ready') // enables the colour transition after first paint
  root.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#070b14' : '#4f46e5')
}

/** Current theme choice and a setter; keeps <html class="dark"> in sync, including OS changes. */
export function useTheme() {
  const [choice, setChoice] = useState(read)

  useEffect(() => {
    apply(choice)
    try { localStorage.setItem(KEY, choice) } catch { /* private mode */ }
    if (choice !== 'system') return undefined
    const m = media()
    const onChange = () => apply('system')
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [choice])

  return [choice, setChoice]
}
