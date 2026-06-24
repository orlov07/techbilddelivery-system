# TechBild Delivery — Project Rules

## Stack

- **React 19** with React Router 7 (single-page, multi-persona architecture)
- **TypeScript 5.8** — all code must be fully typed; no `any` unless unavoidable and explicitly justified
- **Tailwind CSS 4** — utility-first, no custom CSS files unless strictly necessary
- **Supabase** — PostgreSQL database, Auth (Google OAuth), and Realtime subscriptions
- **Firebase Hosting** — production deployment via `npm run deploy`
- **Vite 6** — build tool; use path aliases defined in `vite.config.ts`

## Layout

- **Mobile-first** design: build for small screens first, scale up with Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)
- All views must be fully usable on screens ≥ 320px wide
- Use `BottomNav.tsx` for mobile navigation; avoid adding desktop-only navigation patterns that break on mobile

## Data

- **No mock or simulated data** in production code — all data must come from Supabase via the `db` abstraction in `src/supabaseClient.ts`
- The mock-mode fallback in `supabaseClient.ts` is only acceptable if Supabase env vars are missing (dev convenience); never add new stub data intentionally
- All database operations go through the `db` object — do not import or call `supabase` directly from components

## Code Quality

- **Clean, typed code** — define interfaces/types in `src/types.ts` for any new domain entity
- No implicit `any`; use explicit types or generics
- No commented-out code left in PRs
- No `console.log` statements in committed code
- Prefer editing existing files over creating new ones
- Do not add comments explaining what the code does — only add a comment when the WHY is non-obvious (hidden constraint, workaround, subtle invariant)
- Keep components focused; extract logic to hooks under `src/hooks/` when a component exceeds ~300 lines of logic

## State Management

- Use the existing Context API providers: `AuthContext`, `CartContext`, `StoreContext`
- Do not introduce a new global state library (Redux, Zustand, Jotai, etc.) without explicit authorization
- Local UI state belongs in `useState`/`useReducer` inside the component

## Existing Functionality

- **Do not modify existing features without explicit user authorization** — this includes order flows, payment methods, cashback logic, real-time subscriptions, and RLS policies
- When adding a new feature, isolate it so it cannot regress existing behaviour
- If a change is required near critical paths (order creation, auth, payments), flag it and wait for confirmation before proceeding

## Security

- Never expose secrets — all environment variables must use the `VITE_` prefix and be read from `.env`; never hardcode keys or URLs
- Respect Supabase RLS policies — do not bypass them with `service_role` key in client-side code
- Sanitize all user-facing inputs before sending to the database
- Follow the existing CSP rules defined in `firebase.json`

## Commands

```bash
npm run dev          # Local dev server (port 3000)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run deploy       # Build + deploy to Firebase Hosting
npm run dev:admin    # Admin panel dev mode
npm run build:admin  # Admin panel production build
```

## Environment Variables

All required in `.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |
| `VITE_APP_URL` | Frontend origin for OAuth redirects |
| `VITE_GOOGLE_REDIRECT_URL` | Post-OAuth redirect target |
| `VITE_ADMIN_EMAIL` | Email address granted admin role |

## File Structure Reference

```
src/
├── App.tsx               # Main component — routing, realtime, modals
├── main.tsx              # React root + provider setup
├── types.ts              # All TypeScript interfaces and types
├── supabaseClient.ts     # Unified db abstraction layer
├── components/           # UI components (AdminPanel, Cart, ClientMenu, …)
├── contexts/             # AuthContext, CartContext, StoreContext
├── hooks/                # useAsyncAction, useCEP, useModalA11y
└── utils/                # catalog, notifications, savedAddresses, sound, …
```
