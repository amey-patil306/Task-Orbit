# UI refinement plan

**Status:** phases 1–6 implemented.

Goal: make Task Orbit feel alive, responsive and distinctive without changing the stack.
No new npm dependencies: Tailwind, CSS keyframes and inline SVG only. Every animation is disabled
under `prefers-reduced-motion`.

## Design direction: "orbit"

The product name is the theme. Tasks are planets orbiting the student; the heavier the week, the
more crowded the orbit. Brand gradient: indigo → violet → fuchsia. Load colours (green, amber,
red, dark red) stay exactly as they are, because they carry meaning.

## Phase 1: foundation
- Font: Plus Jakarta Sans (Google Fonts) for headings and UI text.
- Tailwind theme: brand colours, keyframes (`fade-up`, `scale-in`, `shimmer`, `float`,
  `orbit` spin, `shake`, `pop`, `twinkle`), named animations.
- `index.css`: gradient primary button with press feedback, card hover lift, glass panel,
  skeleton shimmer, `.stagger` (children animate in one after another, pure CSS), soft page
  background, reduced-motion override.

## Phase 2: login and register (the "wow" screen)
- Split screen. Left: a live **orbit scene**: starfield, glowing sun ("You" / "Your classes"),
  three rotating orbit rings, planets carrying task chips that stay upright while orbiting, mouse
  parallax tilt. The scene **changes with the selected role**: a student sees deadlines orbiting
  them; a teacher sees classes, and the colours shift from indigo to emerald.
- Rotating headline that cycles through what the app does.
- Form card: glass style; styled "Log in as" dropdown with a role icon; password show/hide; Caps
  Lock warning; **one-click demo chips** (Student / Teacher demo) for the viva; card shakes on a
  failed login; orbit spinner in the button; short "launch" exit animation on success.
- Phones: the scene becomes a compact animated banner above the form.

## Phase 3: app shell
- Sidebar: animated logo, gradient active pill with a glow indicator, user avatar with initials,
  role badge.
- Page transition: every route fades up on change.
- Mobile bottom bar: active tab gets a pill highlight and a small pop.

## Phase 4: shared components
- Orbit-style spinner; **skeleton loaders** instead of a bare spinner for page loads.
- Modal: backdrop blur + fade, panel scales in (slides up on phones).
- Empty states with an orbit illustration; error state with icon.
- Page header: gradient accent bar.

## Phase 5: dashboards
- Student "Today" hero card: gradient background, animated ring gauge for today's load, count-up
  numbers.
- Heatmap cells and the 7-day risk strip pop in one after another; hover lift on cells.
- Dashboard sections stagger in.
- Teacher dashboard: count-up stat tiles and a gradient hero.

## Phase 6: second round
- **Dark mode** with a Light / Dark / System switch (sidebar, mobile header, login). Every
  Tailwind shade we use is a CSS variable; `.dark` swaps them, so existing classes theme
  themselves. Cards use the `surface` colour; tooltips and toasts use the fixed `ink` colour.
  The saved choice is applied before first paint (inline script in `index.html`), so no flash.
- **Toasts** for every action (task saved / deleted, class joined / left, extension sent /
  decided, assignment posted, study hours saved, check-in) and a **confetti burst** when a task
  or study session is marked done or an assignment is posted.
- Remaining pages polished: staggered lists, hover states, tinted action buttons.
- Themed 404 page; each page sets the browser tab title; a new page starts scrolled to the top.

## Out of scope (for now)
- Charting library changes.
