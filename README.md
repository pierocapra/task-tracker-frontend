# Task Tracker — Frontend Client

A plain HTML/CSS/JS client for the Task Tracker API. Built to be the **one
constant piece** across a multi-phase backend learning roadmap — the same UI
talks to a Node/Express backend today, and will switch to point at ASP.NET
Core, Django, and Spring Boot rebuilds of the same API as those phases are
completed, without needing a rewrite.

No build step, no framework, no dependencies. Open `index.html` or deploy the
four files as-is to any static host.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure — auth forms, task list, stack switcher |
| `style.css` | All styling (dark theme, no external fonts/assets) |
| `config.js` | **Edit this** — API base URL per backend stack, and the route paths `app.js` calls |
| `app.js` | All behavior — auth, task CRUD, stack switching, connection status |

---

## How the stack switcher works

The top bar has four tabs — Node.js, ASP.NET, Django, Spring Boot — matching
the four phases of the roadmap. Only the tab for a stack with a `baseUrl` set
in `config.js` is clickable; the rest are shown locked until that phase is
built.

Auth tokens and the signed-in user's display name are stored **per stack**
(keyed by stack name in `localStorage`), so switching tabs won't log you out
of a stack you've already tested — each one keeps its own session.

To bring a new stack online once you've built and deployed it:
1. Set its `baseUrl` in `config.js` (e.g. `aspnet: { baseUrl: "https://your-aspnet-api.onrender.com" }`)
2. Remove `disabled` from its `<button class="stack-tab" ...>` in `index.html`

Nothing else needs to change — the rest of `app.js` is stack-agnostic.

---

## Assumed API shape

`app.js` was written against this REST shape. **If your actual backend's
routes or field names differ, update `API_ROUTES` in `config.js` (paths) or
the request bodies inside `app.js` (field names) — the UI logic itself
doesn't need to change.**

```
POST   /auth/signup   { name, email, password }         -> created user (no token)
POST   /auth/login    { email, password }                -> { token, user }
GET    /tasks                                             -> [ { id, title, completed, createdAt } ]
POST   /tasks         { title }                           -> task
PUT    /tasks/:id     { title } or { completed }          -> task
DELETE /tasks/:id
GET    /health                                             -> { status: "ok" }  (reachability check)
```

Notes on quirks baked into `app.js` to match the real backend:
- **Signup doesn't return a token.** The signup handler calls `/auth/signup`
  then immediately calls `/auth/login` with the same credentials, so it still
  feels like one seamless "create account" action to the user.
- **No `description` field.** The Prisma schema only has `title`,
  `completed`, `createdAt`, and `userId` — the UI was trimmed to match, not
  the other way around.
- **`/health` is required** for the connection-status indicator in the top
  bar to work. It's a route that doesn't exist by default — see the
  [Backend requirements](#backend-requirements) section below.

---

## Backend requirements

For this frontend to work against your Express backend, it needs:

**1. A `/health` route** (used only for the "reachable / unreachable"
indicator, no auth required):

```js
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

**2. CORS configured to allow the frontend's origin(s)** — both local dev and
your deployed static host:

```js
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5500",
  process.env.FRONTEND_URL, // e.g. https://your-site.netlify.app — set in Render's env vars
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
```

Set `FRONTEND_URL` as an environment variable on whatever host runs the
backend (e.g. Render's dashboard → Environment) — not just locally in `.env`.

---

## Running locally

No build step. Two options:

- **Simplest:** double-click `index.html` to open it directly in a browser.
  Note: the browser will send `Origin: null` in this mode, which the CORS
  allow-list above permits via its `!origin` check — fine for quick checks,
  but not representative of how it'll behave once deployed.
- **Closer to production:** serve the folder with a local static server so
  requests carry a real origin, e.g. `npx serve` or VS Code's Live Server
  extension.

Either way, set `config.js`'s active stack's `baseUrl` to wherever your
backend is running (`http://localhost:3000` for local Express, or your
Render URL to test against the deployed API from a local frontend).

---

## Deploying (Netlify)

1. Set `baseUrl` in `config.js` to your deployed backend's URL (no trailing slash).
2. Push this folder to a GitHub repo.
3. In Netlify: **Add new site → Import an existing project** → pick the repo.
   Leave the build command empty; set the publish directory to this folder.
4. Once live, add the Netlify URL to `FRONTEND_URL` in your backend host's
   environment variables (see [Backend requirements](#backend-requirements)) and redeploy the backend.
5. Check the connection bar at the top of the page — it should read
   "reachable" once both sides are configured correctly.

---

## Known trade-offs (deliberate, not oversights)

- **JWT stored in `localStorage`, not an httpOnly cookie.** This means any
  script running on the page (e.g. from an XSS vulnerability) could in
  theory read the token. Acceptable here because this is a learning project
  with no real user data — see the comment block above `state` in `app.js`
  for the full reasoning. The production-correct fix is httpOnly cookies set
  by the backend, which is worth doing properly once each stack's own auth
  system (Identity, Django auth, Spring Security) is covered, rather than
  retrofitting here.
- **Token visible in the Network tab / DevTools.** This is inherent to any
  bearer-token auth scheme, not specific to this app — the browser has to
  send the token on every request for the server to identify the user.
  HTTPS (which both Render and Netlify provide by default) is what actually
  protects it in transit.
- **No CSRF protection.** Not needed with the current localStorage +
  Authorization-header pattern (CSRF specifically targets cookie-based auth,
  where the browser auto-attaches credentials). Would need to be added if
  the app ever migrates to cookie-based auth.

---

## Troubleshooting

**"unreachable" in the connection bar**
- Confirm `config.js`'s `baseUrl` for the active stack is correct and has no trailing slash
- Confirm the backend has a `/health` route (see above)
- Check the browser console for the actual error — a CORS error and a plain network failure look different there

**CORS error in the console**
- Confirm `FRONTEND_URL` is set in the backend host's environment variables (not just local `.env`)
- Confirm it matches the frontend's origin exactly — same scheme (`https://`), no trailing slash
- Redeploy the backend after changing environment variables — they don't hot-reload

**Signup succeeds but nothing happens**
- Check whether your signup route returns a token. If it only returns the
  created user, `app.js` already handles this by chaining a login call
  automatically — but if your login route also doesn't return `{ token,
  user }` in that shape, the chained call will silently fail. Check the
  Network tab for the `/auth/login` request that fires right after signup.
