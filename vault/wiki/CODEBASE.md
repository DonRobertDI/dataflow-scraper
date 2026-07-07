# Codebase Map

npm workspaces monorepo at `/home/${username}/websites/${sandboxId}/public_html`. The web app ships standalone. Call `enable_pocketbase_integration` to add a database, or `enable_api_server_integration` to add an Express backend — each tool appends its own `## apps/<service>` section to this file.

## apps/web (React + Vite + Tailwind + shadcn/ui, port 3000)

Located at apps/web/. Run: `cd apps/web && npm run dev` (auto-started by the sandbox supervisor).
src/main.jsx — entry point, mounts <App />
src/App.jsx — React Router, all routes defined here
src/index.css — Tailwind theme, CSS variables, DataFlow premium blue-and-white SaaS design system
src/pages/HomePage.jsx — "/" route, single-page app shell with view state management, renders Dashboard/History/Documentation views
src/pages/LoginPage.jsx — "/login" route, email/password login form with show/hide password, Remember Me, Forgot Password link, client-side validation, loading state, error/success notifications, link to register
src/pages/RegisterPage.jsx — "/register" route, full name/email/password/confirm password form with password strength indicator, requirements checklist, validation, loading state, success notification, link to login
src/components/Header.jsx — sticky top navigation, logo, nav links (Dashboard, History, Documentation), active state highlighting, user avatar menu with logout
src/components/DashboardView.jsx — extraction interface with URL input, Extract Data button, loading states, results table, CSV/PDF export buttons
src/components/HistoryView.jsx — persistent extraction history table with search by URL, status filters (All/Success/Failed), sorting, pagination (10 per page), View/CSV/PDF/Delete actions per row, empty state, per-user history isolation
src/components/DocumentationView.jsx — knowledge base with Getting Started, Supported Websites, Export Options, expandable FAQ accordion, API status card
src/components/ResultsPanel.jsx — responsive results table with zebra striping, sticky header, CSV/PDF export buttons, empty/loading/error states
src/components/ScrollToTop.jsx — resets scroll on route change
src/components/ProtectedRoute.jsx — route wrapper that redirects unauthenticated users to login, protects Dashboard/History/Documentation
src/components/AuthContext.jsx — React Context for authentication state, login/register/logout/session management, per-user history isolation
src/components/ui/ — shadcn/ui primitives — import from `@/components/ui/<name>`, do not edit the files
src/hooks/use-mobile.jsx — mobile breakpoint detection
src/hooks/use-toast.js — toast notifications
src/hooks/useAuth.js — custom hook for accessing AuthContext
src/lib/auth.js — localStorage-based user registration, login, session persistence with Remember Me, password strength/validation helpers, per-user support, change-password logic
src/lib/utils.js — cn() Tailwind class merge
src/lib/dataflow.js — localStorage persistence for extraction history, export utilities (CSV/PDF), search/filter/sort helpers
vault/wiki/skills/design/SKILL.md — frontend craft, styling, typography, motion, and shadcn policy for UI surfaces.
apps/web/plugins/session-journal/ — infrastructure, DO NOT edit. Vite dev plugin injects the browser session journal client; events go over HMR (`import.meta.hot.send('session-journal:event', …)`); the plugin arranges persistence under `vault/temp/SESSION_JOURNAL.md`.
Routes: / → HomePage (SPA with Dashboard, History, Documentation views), /login → LoginPage, /register → RegisterPage, protected routes require authentication
