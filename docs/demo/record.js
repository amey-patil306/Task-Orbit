// Records the Task Orbit feature walkthrough (video + screenshots) with Playwright.
// See docs/demo/README.md for how to run it.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:5173'
const OUT = process.argv[2]
const SHOTS = path.join(OUT, 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })
const W = 1280, H = 800

// ---------------------------------------------------------------- overlay (caption + visible cursor)
const OVERLAY = () => {
  // Init scripts run before the page's HTML exists, so build the overlay once the document is ready.
  const setup = () => {
  if (window.__demo) return
  window.__demo = true
  const css = document.createElement('style')
  css.textContent = `
    #demo-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
      background:rgba(99,102,241,.25);border:2px solid #6366f1;box-shadow:0 0 0 3px rgba(255,255,255,.7);
      z-index:2147483647;pointer-events:none;transition:transform .15s}
    #demo-cursor.down{transform:scale(.7);background:rgba(99,102,241,.55)}
    .demo-ripple{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #a855f7;
      z-index:2147483646;pointer-events:none;animation:demoRipple .55s ease-out forwards}
    @keyframes demoRipple{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}
    #demo-caption{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:820px;width:max-content;
      z-index:2147483645;pointer-events:none;font:500 16px/1.45 "Plus Jakarta Sans",system-ui,sans-serif;color:#fff;
      background:rgba(15,23,42,.93);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:12px 18px;
      box-shadow:0 20px 50px rgba(0,0,0,.35);transition:opacity .3s;display:flex;gap:12px;align-items:flex-start}
    #demo-caption b{display:block;font-weight:700;font-size:17px;margin-bottom:2px}
    #demo-caption .tag{flex-shrink:0;margin-top:2px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
      padding:3px 8px;border-radius:999px;background:linear-gradient(90deg,#6366f1,#a855f7)}
    #demo-caption .tag.teacher{background:linear-gradient(90deg,#059669,#0d9488)}
    #demo-title{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:radial-gradient(60rem 40rem at 50% 40%,#312e81,#070815);color:#fff;font-family:"Plus Jakarta Sans",system-ui,sans-serif;
      transition:opacity .6s}
    #demo-title h1{font-size:56px;font-weight:800;margin:0;letter-spacing:-.02em}
    #demo-title p{font-size:20px;opacity:.75;margin:.6rem 0 0}`
  document.documentElement.appendChild(css)
  const cur = document.createElement('div'); cur.id = 'demo-cursor'
  document.documentElement.appendChild(cur)
  addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px' }, true)
  addEventListener('mousedown', (e) => {
    cur.classList.add('down')
    const r = document.createElement('div'); r.className = 'demo-ripple'
    r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'
    document.documentElement.appendChild(r); setTimeout(() => r.remove(), 600)
  }, true)
  addEventListener('mouseup', () => cur.classList.remove('down'), true)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup)
  else setup()
}

let mouse = { x: W / 2, y: H / 2 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function caption(page, tag, title, text, ms = 2600) {
  await page.evaluate(({ tag, title, text }) => {
    let c = document.getElementById('demo-caption')
    if (!c) { c = document.createElement('div'); c.id = 'demo-caption'; document.documentElement.appendChild(c) }
    c.innerHTML = `<span class="tag ${tag.toLowerCase().startsWith('teacher') ? 'teacher' : ''}">${tag}</span><span><b>${title}</b>${text}</span>`
    c.style.opacity = '1'
  }, { tag, title, text })
  await sleep(ms)
}
async function hideCaption(page) {
  await page.evaluate(() => { const c = document.getElementById('demo-caption'); if (c) c.style.opacity = '0' })
}

async function moveTo(page, x, y, steps = 22) {
  await page.mouse.move(x, y, { steps })
  mouse = { x, y }
}
async function click(page, locator, { pause = 350 } = {}) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error('no box for ' + locator)
  await moveTo(page, box.x + box.width / 2, box.y + box.height / 2)
  await sleep(pause)
  await page.mouse.down(); await sleep(70); await page.mouse.up()
}
async function type(page, locator, text, delay = 45) {
  await click(page, locator, { pause: 200 })
  await locator.press('Control+A')
  await locator.pressSequentially(text, { delay })
}
async function scrollBy(page, dy, steps = 8) {
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await sleep(60) }
  await sleep(400)
}
let shotNo = 0
async function shot(page, name) {
  await page.evaluate(() => document.querySelectorAll('#demo-caption,#demo-cursor').forEach((e) => (e.style.visibility = 'hidden')))
  shotNo += 1
  const file = `${String(shotNo).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: path.join(SHOTS, file) })
  await page.evaluate(() => document.querySelectorAll('#demo-caption,#demo-cursor').forEach((e) => (e.style.visibility = 'visible')))
  console.log('  shot', file)
}
async function nav(page, label) {
  await click(page, page.getByRole('link', { name: label, exact: true }).first())
  await sleep(1500)
}
async function logout(page) {
  await click(page, page.getByRole('button', { name: 'Log out' }).first())
  await sleep(1500)
}

function istDate(daysAhead) {
  const d = new Date(Date.now() + 5.5 * 3600e3 + daysAhead * 86400e3)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------- the walkthrough
async function desktop(browser) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, colorScheme: 'light', locale: 'en-IN', timezoneId: 'Asia/Kolkata',
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  })
  await ctx.addInitScript(OVERLAY)
  await ctx.addInitScript(() => { try { localStorage.setItem('task-orbit-theme', 'light') } catch {} })
  const page = await ctx.newPage()
  const S = 'Student', T = 'Teacher'

  // ---- Title + login
  console.log('scene: login')
  await page.goto(BASE + '/login'); await sleep(800)
  await page.evaluate(() => {
    const t = document.createElement('div'); t.id = 'demo-title'
    t.innerHTML = '<h1>Task Orbit</h1><p>AI workload planner for students and teachers · feature walkthrough</p>'
    document.documentElement.appendChild(t)
  })
  await sleep(3200)
  await page.evaluate(() => { const t = document.getElementById('demo-title'); t.style.opacity = '0'; setTimeout(() => t.remove(), 700) })
  await sleep(700)
  await caption(page, 'Login', 'Animated login', 'Your tasks orbit you: each planet is a deadline. The scene tilts with the mouse.', 1200)
  for (const [x, y] of [[200, 300], [520, 520], [380, 260], [300, 450]]) await moveTo(page, x, y, 30)
  await shot(page, 'login-student')
  await caption(page, 'Login', '"Log in as" dropdown', 'Choosing Teacher changes the whole screen: classes orbit instead, colours switch to emerald.', 600)
  await click(page, page.locator('#role'))
  await page.selectOption('#role', 'teacher'); await sleep(2600)
  await shot(page, 'login-teacher')
  await page.selectOption('#role', 'student'); await sleep(1200)
  await caption(page, 'Login', 'Wrong role? Clear message', 'Logging in to a teacher account as a student is refused with a helpful hint.', 400)
  await type(page, page.locator('#email'), 'teacher@taskorbit.in', 25)
  await type(page, page.locator('#password'), 'demo12345', 25)
  await click(page, page.locator('button[type=submit]')); await sleep(2600)
  await caption(page, 'Login', 'One-click demo accounts', 'For the viva: fill the student demo account and log in.', 400)
  await click(page, page.getByRole('button', { name: /Student demo/ })); await sleep(700)
  await click(page, page.locator('button[type=submit]')); await sleep(2500)

  // ---- Student
  console.log('scene: student dashboard')
  await caption(page, `${S} 1/11`, 'Dashboard: "Am I in trouble this week?"', "Today's load as a gauge, an AI 7-day risk forecast, and the 14-day heatmap.", 3400)
  await shot(page, 'student-dashboard')
  await caption(page, `${S} 2/11`, 'Weekly stress check-in', 'One tap each week. It is shown as a trend and used as a signal by the ML models.', 500)
  await click(page, page.getByRole('button', { name: 'Change' })); await sleep(700)
  await click(page, page.getByRole('radio', { name: /Busy/ }).or(page.getByRole('button', { name: /Busy/ })).first()); await sleep(1800)
  await scrollBy(page, 560)
  await caption(page, `${S} 2/11`, 'What to do next + heatmap', 'Top tasks by priority and deadline; hover a day to see hours needed vs free.', 600)
  const cell = page.locator('main .pop-seq').nth(2)
  await cell.hover(); await sleep(1800)
  await scrollBy(page, 500); await sleep(800)

  console.log('scene: tasks')
  await nav(page, 'Tasks')
  await caption(page, `${S} 3/11`, 'One task list', 'Teacher assignments arrive automatically (green "Teacher" badge); add personal tasks too.', 2600)
  await shot(page, 'student-tasks')
  await click(page, page.getByRole('button', { name: 'Edit Mini project: schema design' })); await sleep(1500)
  await caption(page, `${S} 3/11`, 'Smart time estimate', 'For teacher tasks: what the teacher expects, the AI estimate for you, and what classmates really took.', 3400)
  await shot(page, 'student-teacher-task')
  await page.keyboard.press('Escape'); await sleep(600)
  await caption(page, `${S} 3/11`, 'Add a personal task', 'After saving, the app says right away whether your next 7 days still fit.', 500)
  await click(page, page.getByRole('button', { name: 'Add task' }).first()); await sleep(700)
  await type(page, page.locator('#title'), 'Read OS chapter 5')
  await page.locator('#due_date').fill(`${istDate(3)}T18:00`); await sleep(300)
  await type(page, page.locator('#estimated_hours'), '2')
  await click(page, page.locator('button[form=task-form]')); await sleep(2600)
  await caption(page, `${S} 3/11`, 'Mark it done (with confetti)', 'You log the real hours: that is the training data that makes forecasts personal.', 400)
  await click(page, page.getByRole('button', { name: 'Mark Read OS chapter 5 done' })); await sleep(800)
  await type(page, page.locator('#actual_hours'), '2.5')
  await click(page, page.locator('button[form=complete-form]')); await sleep(600)
  await shot(page, 'student-task-done')
  await sleep(1800)
  await caption(page, `${S} 4/11`, 'Workload-backed extension request', 'One click on a teacher task. Your real workload is attached as evidence automatically.', 500)
  await click(page, page.getByRole('button', { name: 'Ask for more time on Normalization assignment' })); await sleep(800)
  await type(page, page.locator('#reason'), 'CN unit test and two practicals fall in the same three days.', 22)
  await shot(page, 'student-extension')
  await click(page, page.locator('button[form=extension-form]')); await sleep(2200)
  await page.keyboard.press('Escape'); await sleep(600)

  console.log('scene: planner')
  await nav(page, 'Planner')
  await caption(page, `${S} 5/11`, 'Study planner', 'Builds a day-by-day plan within your available hours, earliest deadline first.', 500)
  await click(page, page.getByRole('button', { name: /Generate plan|Regenerate plan/ }).first()); await sleep(2200)
  await click(page, page.locator('main input[type=checkbox]').first()); await sleep(2200)
  await shot(page, 'student-planner')

  console.log('scene: workload')
  await nav(page, 'Workload')
  await caption(page, `${S} 6/11`, 'Workload, 4 weeks ahead', 'Heatmap, required vs available hours, and the rule label next to the ML label for each day.', 2400)
  await shot(page, 'student-workload')
  await scrollBy(page, 700); await sleep(1600); await scrollBy(page, -700)

  console.log('scene: calendar')
  await nav(page, 'Calendar')
  await caption(page, `${S} 7/11`, 'Calendar', 'Deadlines coloured by subject; red outline = several deadlines clash on that day.', 2000)
  await shot(page, 'student-calendar')
  await click(page, page.getByRole('button', { name: 'Week' })); await sleep(1700)
  await click(page, page.getByRole('button', { name: 'Month' })); await sleep(900)

  console.log('scene: classes')
  await nav(page, 'My classes')
  await caption(page, `${S} 8/11`, 'My classes', "Join with your teacher's code; your extension requests and their status are listed here.", 2800)
  await shot(page, 'student-classes')

  console.log('scene: alerts')
  await nav(page, 'Alerts')
  await caption(page, `${S} 9/11`, 'Alerts', 'Overloaded days, deadline clashes, due-soon tasks, new assignments and extension decisions.', 2600)
  await shot(page, 'student-alerts')

  console.log('scene: settings + dark')
  await nav(page, 'Settings')
  await caption(page, `${S} 10/11`, 'Settings', 'How many hours you can study each day (drives every load calculation) and your subjects.', 2400)
  await caption(page, `${S} 11/11`, 'Dark mode', 'Light, dark or follow the system. Remembered on this device.', 400)
  await click(page, page.getByRole('radio', { name: 'Dark theme' }).first()); await sleep(1500)
  await shot(page, 'student-settings-dark')
  await nav(page, 'Dashboard'); await sleep(1500)
  await shot(page, 'student-dashboard-dark')
  await sleep(1200)
  await click(page, page.getByRole('radio', { name: 'Light theme' }).first()); await sleep(900)
  await logout(page)

  // ---- Teacher
  console.log('scene: teacher dashboard')
  await page.selectOption('#role', 'teacher'); await sleep(900)
  await click(page, page.getByRole('button', { name: /Teacher demo/ })); await sleep(500)
  await click(page, page.locator('button[type=submit]')); await sleep(2600)
  await caption(page, `${T} 1/7`, 'Teacher dashboard', 'Students at risk, the busiest day for your classes, and pending extension requests.', 2800)
  await shot(page, 'teacher-dashboard')
  await scrollBy(page, 420)
  await caption(page, `${T} 1/7`, 'Insights & suggestions', 'Generated from real data, e.g. "took students 1.38x your estimate; plan for about 6 h".', 2800)
  await scrollBy(page, 520); await sleep(1500)

  console.log('scene: new class')
  await nav(page, 'Classes')
  await caption(page, `${T} 2/7`, 'Create a class', 'Each class gets a 6-character join code to share with students.', 400)
  await click(page, page.getByRole('button', { name: /New class/ })); await sleep(700)
  await type(page, page.locator('#c-subject'), 'CG')
  await type(page, page.locator('#c-name'), 'Computer Graphics - SE ECE A', 30)
  await click(page, page.locator('button[form=class-form]')); await sleep(1300)
  const toastText = await page.locator('[aria-live] [role=status]').last().innerText()
  const joinCode = (toastText.match(/code ([A-Z0-9]{6})/) || [])[1]
  console.log('  new class code', joinCode)
  await shot(page, 'teacher-new-class')
  await sleep(1400)

  console.log('scene: class analytics')
  await click(page, page.getByRole('link', { name: /DBMS - SE ECE A/ }).first()); await sleep(2200)
  await caption(page, `${T} 3/7`, 'Class analytics', "Class heatmap: % of students overloaded each day, counting every subject's work, not just yours.", 3000)
  await shot(page, 'teacher-class-overview')
  await scrollBy(page, 560)
  await caption(page, `${T} 3/7`, 'Is my subject the heavy one?', 'Share of the load by subject, expected vs actual hours, early-warning list and stress trend.', 3200)
  await scrollBy(page, 560); await sleep(1500)
  await scrollBy(page, -1120)
  await click(page, page.getByRole('tab', { name: /Students/ })); await sleep(1600)
  await caption(page, `${T} 4/7`, 'Early warning (ML model C)', "Each student's chance of submitting late, with the reasons behind it.", 2800)
  await shot(page, 'teacher-students-risk')

  console.log('scene: deadline advisor')
  await caption(page, `${T} 5/7`, 'Smart Deadline Advisor', 'While creating an assignment, see how the due date hits the whole class before you post it.', 400)
  await click(page, page.getByRole('button', { name: 'New assignment' })); await sleep(800)
  await type(page, page.locator('#a-title'), 'ER diagram lab', 40)
  await type(page, page.locator('#a-hours'), '5')
  await page.locator('#a-due').fill(`${istDate(6)}T23:00`); await sleep(2600)
  await caption(page, `${T} 5/7`, 'Verdict + better dates', '% of students overloaded, other deadlines that day, and up to 3 less harmful dates.', 2600)
  await shot(page, 'teacher-deadline-advisor')
  const better = page.locator('[role=dialog] aside button').first()
  if (await better.count()) { await click(page, better); await sleep(2000) }
  await click(page, page.locator('button[form=assignment-form]')); await sleep(2600)

  console.log('scene: assignment detail')
  await click(page, page.getByRole('link', { name: 'Normalization assignment' }).first()); await sleep(2000)
  await caption(page, `${T} 6/7`, 'Assignment detail', 'Who has started, finished or is late, and expected vs real hours per student.', 2800)
  await shot(page, 'teacher-assignment-detail')

  console.log('scene: extension inbox')
  await nav(page, 'Extension requests')
  await caption(page, `${T} 7/7`, 'Extension inbox', "Each request comes with the student's real workload, so the decision is fair.", 2400)
  const card = page.locator('li.card', { hasText: 'Demo Student' }).first()
  await card.scrollIntoViewIfNeeded(); await sleep(600)
  await shot(page, 'teacher-extension-inbox')
  await type(page, card.getByRole('textbox'), 'Approved: CN test is the same week.', 25)
  await click(page, card.getByRole('button', { name: 'Approve' })); await sleep(2400)
  await logout(page)

  // ---- Back to the student
  console.log('scene: student after')
  await click(page, page.getByRole('button', { name: /Student demo/ })); await sleep(500)
  await click(page, page.locator('button[type=submit]')); await sleep(2200)
  await nav(page, 'Alerts')
  await caption(page, `${S} again`, 'The loop closes', 'The student sees the approved extension and the new assignment from the teacher.', 3000)
  await shot(page, 'student-alerts-after')
  if (joinCode) {
    await nav(page, 'My classes')
    await caption(page, `${S} again`, 'Join the new class', `Enter the code ${joinCode}; its upcoming work appears in your tasks automatically.`, 400)
    await type(page, page.getByLabel('Class code'), joinCode, 90)
    await click(page, page.getByRole('button', { name: 'Join' })); await sleep(2600)
  }
  await nav(page, 'Tasks')
  await caption(page, 'Task Orbit', 'Thanks for watching', 'React + Flask + scikit-learn · github.com/amey-patil306/Task-Orbit', 3500)

  const video = page.video()
  await ctx.close()
  fs.renameSync(await video.path(), path.join(OUT, 'task_orbit_demo.webm'))
}

async function mobile(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    colorScheme: 'light', locale: 'en-IN', timezoneId: 'Asia/Kolkata',
    recordVideo: { dir: OUT, size: { width: 390, height: 844 } },
  })
  await ctx.addInitScript(OVERLAY)
  await ctx.addInitScript(() => { try { localStorage.setItem('task-orbit-theme', 'light') } catch {} })
  const page = await ctx.newPage()
  console.log('scene: mobile')
  await page.goto(BASE + '/login'); await sleep(2200)
  await shot(page, 'mobile-login')
  await page.getByRole('button', { name: /Student demo/ }).tap(); await sleep(400)
  await page.locator('button[type=submit]').tap(); await sleep(2600)
  await shot(page, 'mobile-dashboard')
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 380); await sleep(900) }
  await page.getByRole('link', { name: 'Tasks', exact: true }).tap(); await sleep(1800)
  await page.getByRole('link', { name: 'Load', exact: true }).tap(); await sleep(1800)
  await page.getByRole('radio', { name: 'Dark theme' }).tap(); await sleep(800)
  await page.getByRole('link', { name: 'Home', exact: true }).tap(); await sleep(2200)
  await shot(page, 'mobile-dashboard-dark')
  await page.getByRole('link', { name: 'Plan', exact: true }).tap(); await sleep(2000)
  const video = page.video()
  await ctx.close()
  fs.renameSync(await video.path(), path.join(OUT, 'task_orbit_demo_mobile.webm'))
}

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    await desktop(browser)
    await mobile(browser)
  } finally {
    await browser.close()
  }
  console.log('done')
})().catch((e) => { console.error(e); process.exit(1) })
