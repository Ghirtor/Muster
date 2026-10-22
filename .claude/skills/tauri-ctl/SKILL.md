---
name: tauri-ctl
description: Use when driving or inspecting the running Flotilla Tauri desktop app — clicking through its UI, reading its DOM, screenshotting, or checking the dashboard in the real WebView2 window instead of jsdom or the browser pane.
---

# tauri-ctl

Start the desktop app with Chrome DevTools Protocol on **`http://localhost:4872`**, in the
background (it runs the supervisor and Vite first, like `npm run dev`):

```bash
npm run dev:desktop
```

`4872` sits next to Flotilla's own ports because Demo's rig already holds `9222`. Attach to it
with the `dev-browser` CLI, **from Bash** — PowerShell wires stdin in a way it cannot tolerate,
and the call hangs to timeout with zero output:

```bash
dev-browser --connect http://localhost:4872 --timeout 30 run ~/.dev-browser/tmp/01-step.js
```

`dev-browser --help` is the API reference — sandbox limits, `snapshotForAI`, refs, `writeFile`,
timeouts, the look → act → verify loop. This skill only covers what is true of **this app**.

## Four rules for this app

**1. Attach only to the dashboard target.** In `dev:desktop` the window loads
`http://localhost:4870/`; a packaged build loads `http://127.0.0.1:4871/` from the supervisor.
`:4872` also exposes DevTools and internal frames, and an evaluate against the wrong one silently
runs in the wrong context.

```js
const pages = await browser.listPages();
const target = pages.find(p => /^http:\/\/(localhost:4870|127\.0\.0\.1:4871)\//.test(p.url));
const page = await browser.getPage(target.id);
```

**2. Never navigate off-origin.** The Tauri IPC bridge is bound to the window's origin; leave it
and the only fix is restarting the app. `typeof window.__TAURI_INTERNALS__ === "object"` proves
the bridge is live.

**3. Keep scripts out of the repo tree.** Vite HMR is on, so writing anywhere under the repo
re-mounts React and erases mid-scenario state. `~/.dev-browser/tmp/` is both safe and where the
sandbox's file helpers already resolve.

**4. Prefer `getByRole` over snapshot refs.** Fleet and app status stream in over the WebSocket,
so a ref can die between snapshotting and clicking. When a count or a role matters, cross-check
with a DOM `page.evaluate` query.

Stop the app when done: close the window, then stop the background command, so `:4870`, `:4871`
and `:4872` are free for the next session.
