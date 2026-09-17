# Pakadbandi

A browser-based short-film shooting planner built from `PAKADBANDI_TECHNICAL_SPEC.md`. Hosted on Vercel with an Upstash Redis cloud snapshot and a key-protected save endpoint.

## Run locally

Use Node 22.13+ (or a newer supported LTS) and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The bundled demo is the supplied super final export of “Yachacha Gachacha”: 29 shots, 12 people, 193 availability overrides, and all 29 shots scheduled. Its shooting range is September 19–27, 2026; the calendar opens on September 19 with no shot selected. When no cloud project exists, fresh visits load this snapshot from `src/data/demo-project.v1.json`. Reset demo always restores it locally.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

The frontend production output is in `dist/`. The Vercel function in `api/project.ts` loads and saves one project snapshot in Upstash Redis. The saved project is publicly readable; updates require a separate save key. Theme choice lasts only for the current page session. No browser storage is used for credentials. `npm run dev` serves both the editor and the cloud API at http://localhost:5173, using server-only credentials from `.env.local`. Restart the dev server after changing credentials. Local saves use the configured Redis key, so they update the same cloud snapshot as any deployment using that key. `npm run preview` serves only the static build; use the dev server or Vercel for cloud access.

## Plan a shoot

- Select a shot to preview suitable sessions. Drag its grip onto a session, or open **Schedule shot** to choose a date, session, and filming position with ordinary keyboard-accessible controls.
- A session marked **Fits** has available people and sufficient production time. **Unconfirmed** permits tentative placement. **Blocked** rejects the entire placement and names the reason.
- Drag above an existing card to insert before it; drop elsewhere in the session to append. Use **Filming order** in the scheduling dialog for a precise alternative. Move a scheduled shot back to the shelf by dragging or choosing **Unschedule**.
- Choose a cast/crew member, select an availability tool, and click or paint cells. Date headings apply the tool to the whole day. **Edit range & reasons** supports all operations without painting, including removal of overrides.
- New people start unconfirmed. Core crew is inherited by every shot. Availability applies to the whole session.
- Open **Project settings** to edit the title, production timezone, shooting range, session labels/times, daylight assumptions, and core crew. The range cannot strand assignments or dated overrides; remove those records first.
- **Export JSON** initiates a download. Import validates the complete file and shows a replacement preview. Use **Save to cloud** to publish the current project after entering your save key. Keep exported files as backups. Unsaved edits remain local to this tab.
- On phones, switch between Shots, Schedule, and People. The calendar displays one day, with the same scheduling dialog and editing functions.

## Architecture and decisions

`src/domain/` contains strict Zod schemas, local-date helpers, typed commands, structural validation, and ordered scheduling rules. It imports no React or DOM APIs. `src/state/` owns immutable project state and revision/export tracking through a reducer and separate read/command contexts. UI state is local to the application and never enters project files. Browser file operations are isolated in `src/features/project-files.ts`.

The app uses React + TypeScript + Vite, Tailwind with semantic theme variables, local shadcn-style Radix primitives, Lucide icons, and the current `@dnd-kit/react` API family. No legacy dnd-kit API is mixed in. Exact dependency resolutions are recorded in `package-lock.json`.

Scheduling first removes the moving shot, inserts at the requested position, then evaluates every shot in the target order. Lighting uses the earliest contiguous legal interval and counts waiting separately. Existing conflicts from edits are retained for repair. Unavailable people, overflow, and impossible lighting cannot be bypassed.

The spec’s proposed defaults are the implementation baseline under the user’s September 14 instruction to follow the spec and build: one filming unit; sequential shots; whole-session staffing; tentative unknown availability; four stable session IDs; manually configured daylight; core crew; session-only themes; 90-day, 500-shot, 200-person and 5 MiB file limits. The byte-size limit can be reached before the record-count limits for dense or verbose projects.

The domain boundary validates mutations again against the current reducer state. Failed and no-op commands do not increment the revision. Derived availability/person/shot indexes use immutable collection identities. Code outside the command boundary must not mutate projects in place.

## Browser checks

The suite covers Chromium, Firefox, and WebKit. Install the browser runtimes once:

```sh
npx playwright install chromium firefox webkit
npm run test:e2e
```

`test:e2e` builds a minified standalone domain benchmark before running browser tests. Screenshots, performance reports, and failure traces are written under `output/playwright/` or `test-results/` and are ignored by Git. The optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` environment variable can target an installed Chromium executable.

Domain/component tests cover validation, lighting/waiting, ordering, availability, dependency checks, revision tracking, form submissions, and JSON exchange. Browser tests cover the editing/scheduling/export/reset/import journey, rejected and canceled dragging, reordering, mobile layouts, themes, timezone independence, and performance on a 100-shot/30-person/30-day fixture. `tests/fixtures/demo-project.v1.json` is a separate, stable scheduling regression fixture; it does not supply the app’s demo.

## Deploy to Vercel

Import `nemigna/pakadbandhi` into Vercel and use `master` as the production branch. Keep the root directory at the repository root. The checked-in `vercel.json` selects Vite, installs with `npm ci`, builds with `npm run build`, and serves `dist/`. Node 22.x is selected through `package.json`. SPA requests fall back to `index.html`; `/api/` routes are excluded from that rewrite.

Configure these server-side environment variables in Vercel before deploying:

- `UPSTASH_REDIS_REST_URL`: your Upstash REST endpoint.
- `UPSTASH_REDIS_REST_TOKEN`: the database write token.
- `PAKADBANDI_SAVE_KEY`: a separate random secret of 24–256 characters. Generate one with `openssl rand -hex 24`; this is what you enter in the Save dialog.
- `PAKADBANDI_REDIS_KEY`: optional, defaults to `pakadbandi:project:v1`. Set a different key (or use a separate database) for Preview deployments to isolate test saves.

See `.env.example`. Put local values in the ignored `.env.local`; never prefix secrets with `VITE_`. Redeploy after changing Vercel environment variables. After connecting the repository, pushes to the production branch trigger deployments. An authenticated Vercel CLI can also deploy with `npx vercel --prod`.

At startup, the app reads the cloud snapshot. An empty database opens the demo without writing it; the first successful save creates the snapshot. If loading fails, the demo editor remains available with a visible error and cloud saving disabled; export any local edits before reloading to retry. Editing, import, and Reset demo do not write to the database until you explicitly save.

The server validates project structure, checks the separate save key with a constant-time comparison, and rate-limits failed key attempts per client over five minutes. An atomic Redis Lua operation checks the loaded version before saving, so a stale tab cannot silently overwrite a newer save. On a conflict, export local edits and reload; there is no automatic merge. Saves replace the snapshot without a TTL. Keep JSON exports as backups; cloud history is not maintained.

Cloud requests are capped at 4,000,000 bytes to leave headroom below Vercel’s 4.5 MB function payload limit. Local import/export retains its existing 5 MiB limit. Credentials and upstream error details are never returned by the API. Anyone who knows the save key can write; there are no individual user accounts. Public reads include the entire project, including names and availability notes.

Configuration follows [Vercel’s Vite guide](https://vercel.com/docs/frameworks/frontend/vite). Human review of assistive technology, touch ergonomics, and real device behavior remains valuable; automated checks do not certify WCAG conformance. Labor rules, astronomical daylight, optimization, call sheets, and multi-user persistence are outside this version.

API references used during implementation: [dnd-kit React quickstart](https://dndkit.com/react/quickstart/) and [shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite).

## Props and JSON compatibility

The Props tab opens a separate workspace. Create named props with notes, select a prop to see its scenes and shots, and use the searchable shot checklist to tag or untag it. The shot editor also has a Props checklist. Deleting a prop removes its shot tags while preserving shots, availability, and scheduling.

Version 1 JSON imports and existing cloud records remain readable: missing `project.props` and shot `propIds` become empty lists in memory. Exports now use schema version 2. The Redis key stays unchanged; loading does not rewrite the stored record. Explicit cloud saves include the new fields. Older clients missing these fields receive HTTP 409 without a database write, even if their cloud version token is current. Existing optimistic concurrency checks still apply.

Before production rollout, export the current cloud project as a backup and deploy frontend and API together. Verify an existing project opens with empty props and its shots/availability intact. Do not roll back to the old API after saving props without a compatible reader/writer; the old strict schema cannot read the added fields. No live cloud data is migrated as part of the code change.
