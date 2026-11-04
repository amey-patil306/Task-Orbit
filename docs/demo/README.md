# Demo recordings

| File | What it is |
|---|---|
| `task_orbit_demo.webm` | Full captioned walkthrough, desktop 1280×800, about 3 minutes |
| `task_orbit_demo_mobile.webm` | Short phone walkthrough, 390×844 |
| `screenshots/` | The stills used in [`../WALKTHROUGH.md`](../WALKTHROUGH.md) |
| `record.js` | The script that recorded all of the above |

Open the `.webm` files in Chrome, Edge, Firefox or VLC.

## Re-recording the demo

The recording is scripted with [Playwright](https://playwright.dev), so it can be redone in
a few minutes after UI changes. Playwright is not a project dependency; install it somewhere
outside the repo.

1. Start the app on a freshly seeded database. The script creates a class, posts an assignment and
   approves an extension, so seed again before each run.

   ```powershell
   cd backend
   .venv\Scripts\python scripts\seed.py
   .venv\Scripts\flask --app wsgi run
   ```

   ```powershell
   cd frontend
   npm run build
   npx vite preview --port 5173
   ```

2. In a separate folder, install Playwright and its video encoder, then run the script:

   ```powershell
   npm init -y
   npm i playwright@1.48.2
   npx playwright install ffmpeg
   node <path-to-repo>\docs\demo\record.js <output-folder>
   ```

   It uses your installed Google Chrome (`channel: 'chrome'`), so no browser download is needed.

3. Optional: Playwright writes a keyframe only at the start, so long videos are hard to scrub.
   Re-encoding with regular keyframes fixes that (Playwright's ffmpeg is enough):

   ```powershell
   ffmpeg -i task_orbit_demo.webm -an -c:v vp8 -b:v 1M -crf 10 -g 50 out.webm
   ```
