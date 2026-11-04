import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * The animated "orbit" behind the login and register forms.
 * Tasks (for students) or classes (for teachers) circle a glowing sun. Pure CSS + SVG, no libraries.
 *
 * How a planet keeps its label upright: each planet sits on its own full-size ring that spins,
 * and the label inside spins the other way at the same speed, so the two rotations cancel out.
 * A negative animation-delay starts each planet at a different point of its orbit.
 */

const THEMES = {
  student: {
    sun: 'from-indigo-400 via-violet-500 to-fuchsia-500',
    glow: 'bg-violet-500',
    nebula: ['bg-indigo-600', 'bg-fuchsia-600', 'bg-violet-700'],
    centre: 'You',
    planets: [
      { ring: 0, at: 0.05, label: 'DBMS worksheet', meta: 'due Fri', dot: 'bg-indigo-400' },
      { ring: 0, at: 0.55, label: 'OS practical', meta: '2 h', dot: 'bg-sky-400' },
      { ring: 1, at: 0.2, label: 'CN unit test', meta: 'exam', dot: 'bg-rose-400' },
      { ring: 1, at: 0.72, label: 'Mini project', meta: '6 h', dot: 'bg-amber-400' },
      { ring: 2, at: 0.4, label: 'Hackathon prep', meta: 'personal', dot: 'bg-emerald-400' },
      { ring: 2, at: 0.9, label: 'Study plan', meta: 'ready', dot: 'bg-fuchsia-400' },
    ],
    stat: { title: 'AI forecast', value: 'Thu looks heavy', hint: '3 deadlines · 128% load', tone: 'text-rose-300' },
    lines: [
      'Every deadline, in one orbit.',
      'Know you are overloaded before it happens.',
      'A study plan that fits your real hours.',
    ],
  },
  teacher: {
    sun: 'from-emerald-300 via-teal-400 to-cyan-500',
    glow: 'bg-teal-500',
    nebula: ['bg-emerald-600', 'bg-cyan-600', 'bg-teal-700'],
    centre: 'Your classes',
    planets: [
      { ring: 0, at: 0.1, label: 'SE-A · DBMS', meta: '30 students', dot: 'bg-emerald-400' },
      { ring: 0, at: 0.6, label: 'Class code', meta: 'DBMS4A', dot: 'bg-teal-300' },
      { ring: 1, at: 0.3, label: 'Normalization', meta: 'due Mon', dot: 'bg-cyan-400' },
      { ring: 1, at: 0.8, label: '2 requests', meta: 'extensions', dot: 'bg-amber-400' },
      { ring: 2, at: 0.15, label: 'At-risk students', meta: '6', dot: 'bg-rose-400' },
      { ring: 2, at: 0.62, label: 'Insights', meta: '1.4× estimate', dot: 'bg-lime-300' },
    ],
    stat: { title: 'Deadline Advisor', value: 'Mon, 9 Nov is better', hint: '17% overloaded · no clashes', tone: 'text-emerald-300' },
    lines: [
      'See the class workload before you set a deadline.',
      'Pick the least harmful due date.',
      'Spot students falling behind, early.',
    ],
  },
}

const TILT = 55
const BASE_TILT = `rotateX(${TILT}deg)`

const RINGS = [
  { size: 230, speed: 26 },
  { size: 350, speed: 40, reverse: true },
  { size: 470, speed: 58 },
]

/** Same star positions every render (a tiny seeded random), so the sky doesn't jump. */
function useStars(count) {
  return useMemo(() => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: count }, () => ({
      left: `${rand() * 100}%`, top: `${rand() * 100}%`,
      size: rand() < 0.15 ? 2.5 : rand() < 0.5 ? 1.5 : 1,
      twinkle: `${2 + rand() * 4}s`, delay: `${-rand() * 6}s`,
    }))
  }, [count])
}

function Planet({ planet, ring }) {
  // Spin in the tilted plane -> sit on the ring -> spin back -> un-tilt, so the label faces the viewer.
  const timing = { '--orbit-speed': `${ring.speed}s`, animationDelay: `${-planet.at * ring.speed}s` }
  const spin = ring.reverse ? 'animate-orbit-rev' : 'animate-orbit'
  const counter = ring.reverse ? 'animate-orbit' : 'animate-orbit-rev'
  return (
    <div className={`absolute left-1/2 top-1/2 [transform-style:preserve-3d] ${spin}`}
      style={{ ...timing, width: ring.size, height: ring.size, marginLeft: -ring.size / 2, marginTop: -ring.size / 2 }}>
      <div className="absolute left-1/2 top-0 [transform-style:preserve-3d] [transform:translate(-50%,-50%)]">
        <div className={`[transform-style:preserve-3d] ${counter}`} style={timing}>
          <div className="[transform:rotateX(-55deg)]">
          <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/10 py-1 pl-1.5 pr-3 text-xs text-white shadow-lg shadow-black/20 backdrop-blur-md transition-colors duration-700">
            <span className={`h-4 w-4 rounded-full ${planet.dot} shadow-[0_0_12px_currentColor] transition-colors duration-700`} />
            <span className="font-semibold">{planet.label}</span>
            <span className="text-white/60">{planet.meta}</span>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OrbitScene({ role = 'student', compact = false }) {
  const theme = THEMES[role] ?? THEMES.student
  const stars = useStars(compact ? 40 : 90)
  const tiltRef = useRef(null)
  const [line, setLine] = useState(0)

  // Cycle the headline every few seconds.
  useEffect(() => {
    setLine(0)
    const id = setInterval(() => setLine((n) => (n + 1) % theme.lines.length), 3200)
    return () => clearInterval(id)
  }, [theme])

  // Mouse parallax: tilt the orbit a few degrees toward the pointer (no re-render, direct style).
  const onPointerMove = (e) => {
    if (!tiltRef.current || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    tiltRef.current.style.transform = `rotateX(${TILT - y * 10}deg) rotateZ(${x * 8}deg)`
  }
  const onPointerLeave = () => {
    // Back to the resting tilt (clearing it would leave the orbit flat until the next render).
    if (tiltRef.current) tiltRef.current.style.transform = BASE_TILT
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070815] text-white"
      onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} aria-hidden="true">
      {/* Nebula glows (colour follows the role) */}
      <div className={`absolute -left-24 -top-24 h-96 w-96 rounded-full ${theme.nebula[0]} opacity-30 blur-3xl transition-colors duration-1000`} />
      <div className={`absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full ${theme.nebula[1]} opacity-25 blur-3xl transition-colors duration-1000`} />
      <div className={`absolute left-1/3 top-1/2 h-72 w-72 rounded-full ${theme.nebula[2]} opacity-20 blur-3xl transition-colors duration-1000`} />

      {/* Stars */}
      {stars.map((s, i) => (
        <span key={i} className="absolute animate-twinkle rounded-full bg-white"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, '--twinkle': s.twinkle, animationDelay: s.delay }} />
      ))}

      {/* The orbit system, tilted in 3D */}
      <div className="absolute inset-0 flex items-center justify-center [perspective:1100px]">
        <div className={compact ? 'scale-[.5]' : 'scale-[.78] xl:scale-90 2xl:scale-100'}>
          <div ref={tiltRef} className="relative h-[480px] w-[480px] transition-transform duration-500 ease-out [transform-style:preserve-3d]"
            style={{ transform: BASE_TILT }}>
            {RINGS.map((ring) => (
              <div key={ring.size} className="absolute left-1/2 top-1/2 rounded-full border border-dashed border-white/25 shadow-[0_0_30px_rgba(255,255,255,.04)]"
                style={{ width: ring.size, height: ring.size, marginLeft: -ring.size / 2, marginTop: -ring.size / 2 }} />
            ))}
            {theme.planets.map((p) => <Planet key={`${role}-${p.label}`} planet={p} ring={RINGS[p.ring]} />)}
            {/* Sun */}
            <div className="absolute left-1/2 top-1/2 -ml-14 -mt-14 h-28 w-28 [transform:rotateX(-55deg)]">
              <div className={`absolute inset-0 animate-glow rounded-full ${theme.glow} blur-2xl transition-colors duration-1000`} />
              <div className={`relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${theme.sun}
                shadow-[inset_-10px_-12px_24px_rgba(0,0,0,.35),inset_8px_8px_20px_rgba(255,255,255,.35)] transition-all duration-1000`}>
                <span className="px-3 text-center text-[13px] font-bold leading-tight drop-shadow">{theme.centre}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Headline + floating insight card */}
      {!compact && (
        <>
          <div className="absolute inset-x-0 top-0 p-10 xl:p-14">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">
              {role === 'teacher' ? 'For teachers' : 'For students'}
            </p>
            <h2 key={`${role}-${line}`} className="mt-3 max-w-md animate-fade-up text-3xl font-bold leading-tight xl:text-4xl">
              {theme.lines[line]}
            </h2>
            <div className="mt-4 flex gap-1.5">
              {theme.lines.map((_, i) => (
                <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i === line ? 'w-8 bg-white' : 'w-3 bg-white/30'}`} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-10 left-10 animate-float rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-md xl:left-14">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{theme.stat.title}</p>
            <p key={role} className={`mt-1 animate-fade-in font-semibold ${theme.stat.tone}`}>{theme.stat.value}</p>
            <p className="mt-0.5 text-xs text-white/60">{theme.stat.hint}</p>
          </div>
        </>
      )}
    </div>
  )
}
