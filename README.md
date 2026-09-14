# Pakadbandi

A browser-based short-film shooting planner built from `PAKADBANDI_TECHNICAL_SPEC.md`. Configured for static hosting on Vercel.

## Run locally

Use Node 22.13+ (or a newer supported LTS) and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The bundled demo is the supplied September 14 export of “The way home”: 33 shots, 12 people, 61 availability overrides, and 6 scheduled shots. Its shooting range is September 19–27, 2026; the calendar opens on September 19 with SH 01 selected. Fresh visits and Reset demo load this snapshot from `src/data/demo-project.v1.json`.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

The static production output is in `dist/`. No backend, secrets, accounts, analytics, localStorage, sessionStorage, or project database is used. Refreshing restores the bundled demo. Theme choice also lasts only for the current page session.

## Plan a shoot

- Select a shot to preview suitable sessions. Drag its grip onto a session, or open **Schedule shot** to choose a date, session, and filming position with ordinary keyboard-accessible controls.
- A session marked **Fits** has available people and sufficient production time. **Unconfirmed** permits tentative placement. **Blocked** rejects the entire placement and names the reason.
- Drag above an existing card to insert before it; drop elsewhere in the session to append. Use **Filming order** in the scheduling dialog for a precise alternative. Move a scheduled shot back to the shelf by dragging or choosing **Unschedule**.
- Choose a cast/crew member, select an availability tool, and click or paint cells. Date headings apply the tool to the whole day. **Edit range & reasons** supports all operations without painting, including removal of overrides.
- New people start unconfirmed. Core crew is inherited by every shot. Availability applies to the whole session.
- Open **Project settings** to edit the title, production timezone, shooting range, session labels/times, daylight assumptions, and core crew. The range cannot strand assignments or dated overrides; remove those records first.
- **Export JSON** initiates a download. Import validates the complete file and shows a replacement preview. Keep the exported file to retain your work; the website URL does not share your edits.
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

Import `nemigna/pakadbandhi` into Vercel and use `master` as the production branch. Keep the root directory at the repository root. The checked-in `vercel.json` selects Vite, installs with `npm ci`, builds with `npm run build`, and serves `dist/`. Node 22.x is selected through `package.json`. SPA requests fall back to `index.html`.

No environment variables, database, or server functions are required. After connecting the repository, pushes to the production branch trigger deployments. Alternatively, an authenticated Vercel CLI can deploy from this directory with `npx vercel --prod`.

Hosting shares the application and bundled demo; each visitor’s edits remain in their browser session. JSON export/import is still required to save or transfer a project.

Configuration follows [Vercel’s Vite guide](https://vercel.com/docs/frameworks/frontend/vite). Human review of assistive technology, touch ergonomics, and real device behavior remains valuable; automated checks do not certify WCAG conformance. Labor rules, astronomical daylight, optimization, call sheets, and multi-user persistence are outside this version.

API references used during implementation: [dnd-kit React quickstart](https://dndkit.com/react/quickstart/) and [shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite).
