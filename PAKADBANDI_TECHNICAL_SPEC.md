# Pakadbandi — Technical Specification

**Version:** 0.1 — draft for review  
**Date:** September 14, 2026  
**Status:** Product direction agreed; technical details and proposed defaults awaiting review.  
**Deliverable:** Specification only. Application implementation starts after agreement on this document.

Throughout this document, **Requirement** means agreed product scope, **Proposed default** means an implementation recommendation awaiting review, and **Future** means explicitly outside version one. Acceptance criteria describe the intended implementation after the proposed defaults are accepted.

## 1. Summary

### Problem

Planning a short film requires arranging shots around the availability of actors and crew. A whiteboard of sticky notes makes the shots easy to see, but does not automatically reveal scheduling conflicts, session overload, or daylight requirements.

### Goal

Build **Pakadbandi**, a browser-based planning website that combines an unscheduled shot shelf, a shooting calendar, and a visual cast-and-crew availability editor. A planner should be able to pick up a shot, see suitable sessions, and place it with an explanation of any constraints.

### Outcome

A visitor opens a populated demo, experiments with shots and people, and exports the current project as JSON. Importing that JSON reconstructs the project. The interface supports polished light and dark themes.

**Requirement:** Version one has no project database, account system, or automatic project persistence. Edits live in memory for the current page session. Reloading initializes the bundled demo again. Supabase is a possible future backend.

The earlier images are visual references, not implemented screens. Their old “Shotboard” branding and browser-autosave wording are superseded. All application branding must say **Pakadbandi**.

## 2. Scope

### In scope

- React website with bundled, fictional demo data.
- Light, dark, and a proposed system-following theme option.
- Shot creation, editing, deletion, search, and scheduling.
- Cast and crew creation, editing, and per-session availability.
- A calendar with dates across columns and four shooting sessions down rows.
- Dragging shots between the shelf and calendar, moving between sessions, and reordering within a session.
- A click/keyboard alternative to dragging.
- Availability, duration, and optional lighting checks.
- Rechecking scheduled shots after relevant project edits.
- JSON import/export and reset-to-demo.
- Responsive access to the same functions, with desktop as the primary planning surface.
- A tested separation between UI, project state, scheduling rules, and file handling.

### Out of scope

- Login, server storage, browser project databases, or automatic project recovery after refresh.
- Supabase integration, real-time collaboration, and cast self-service availability collection.
- An automatic schedule optimizer.
- Multiple simultaneous shooting units.
- Generated or distributed call sheets, messaging, PDF reports, and calendar-service synchronization.
- Script parsing, storyboard uploads, budgets, equipment inventories, location bookings, and recurring availability rules.
- Automatic sunrise/sunset lookup, weather integration, and labor-rule calculations.
- PWA installation or guaranteed offline reopening.

**Terminology:** The four rows are **shooting sessions**. A call sheet is a later document produced from a schedule; a session is not itself a call sheet.

## 3. Actors and Context

### Primary user

The planner is a director, assistant director, producer, or other person organizing a short-film shoot. They enter availability on behalf of the cast and crew in version one.

### Systems

1. A static host serves the application and its bundled demo.
2. React holds the editable project in the page's memory.
3. The browser reads an explicitly selected JSON file and initiates project downloads.

There are no server API calls for project operations. Import means reading a local file into the page; the file is not uploaded to a backend.

### Roles and permissions

There is one local editor with access to all demo/project functions. Cast and crew are project records, not authenticated users. Anyone opening the website receives an independent demo instance. Sending someone the website URL does not share the sender's edits.

## 4. Functional Requirements

### FR-1 — Branding and application shell

- Display **Pakadbandi** in the header, document title, project-file naming, and relevant accessible labels.
- Header controls: project title, demo/imported-project indicator, theme menu, Reset demo, Import JSON, and Export JSON.
- Demo wording: **“Demo mode · Export to save.”**
- Imported-project wording: **“Imported project · Export to save changes.”**
- After an edit, show **“Changes not exported.”** Do not display “Saved” merely because state changed in memory.
- After triggering an export, use **“Export started”** or equivalent; the browser cannot establish that the user retained the file.

### FR-2 — Initial demo

- Load the same valid bundled project on a fresh page load; deep-copy it before editing.
- Show the September 20–24, 2026 example week initially, independent of today's date.
- Include at least eight shots: four scheduled and four unscheduled, several locations, named actors, and named crew members.
- Include both explicit availability and unconfirmed availability so the legend has a meaningful example.
- Ravi is unavailable September 20 afternoon and September 24 all day. SH 012 requires Ravi and Asha.
- Include at least one clearly valid target for SH 012, with all required people explicitly available.
- Select SH 012 initially to demonstrate suitability; provide “Clear selection.”
- Scheduled demo shots begin without hard conflicts. Explain blocked targets through the selected unscheduled shot rather than preloading a broken schedule.

### FR-3 — Shot records and shelf

Each shot includes a stable ID, visible code, title, optional scene label, description, required people, location label, estimated session time, lighting requirement, and visual color.

- Show compact cards containing the most useful details, with full details in an editing sheet or dialog.
- A shot's duration includes its expected setup, takes, and reset time. It is production time, not final screen duration.
- Link required actors and crew to person IDs. Role names alone do not satisfy staffing requirements.
- Search by code, title, scene label, person name, and location.
- Search changes visibility only; it never deletes or unschedules records.
- A shot exists once in the project and can have at most one assignment.
- Deleting a shot removes its assignment atomically, after a confirmation identifying the shot.

### FR-4 — People and required crew

- Create and edit people with a display name, cast/crew classification, and role label.
- Allow multiple people to share a role and one person to belong to both cast and crew.
- New people default to **unconfirmed** availability; demo people may have explicit defaults.
- **Proposed default:** Project settings can identify core crew required for every shot. Shot-specific people are added to that set. The shot details distinguish inherited core crew from directly selected people.
- A person's name change updates all displays through their ID references.
- Block deletion while the person is referenced by a shot or core-crew setting. Show the references and require reassignment/removal first. Do not silently remove a scheduling requirement.

### FR-5 — Availability editor

Select a person to see a matrix of dates and sessions. Status values are **available**, **unavailable**, and **unconfirmed**.

- Select a status tool, then click cells or paint across them to apply that status.
- A date-heading action applies the selected status to all four sessions on that day.
- Provide an accessible edit dialog with date range, session selection, status, and optional reason. It must offer all painting capabilities without dragging.
- Applying a date range materializes explicit cell overrides; recurring rules are not part of version one.
- One effective override exists for each person/date/session key. New edits replace the existing override at that key.
- Removing an override restores the person's default status. A preview explains this before applying a bulk clear.
- Whole-day and partial-day edits can coexist naturally: changing one session after marking a whole day unavailable replaces only that cell.
- The sidebar may group adjacent equal cells into readable summaries such as “24 Sep · All day.” These summaries are derived, not a separate rule store.
- Recalculate all affected assigned shots immediately after an availability change.

### FR-6 — Scheduling calendar

Dates are columns. Sessions are rows, with these defaults:

| ID | Label | Local time | Capacity |
|---|---|---|---:|
| morning | Morning | 06:00–11:00 | 300 minutes |
| afternoon | Afternoon | 14:00–16:00 | 120 minutes |
| evening | Evening | 17:00–20:00 | 180 minutes |
| night | Night | 20:00–24:00 | 240 minutes |

- **Proposed default:** Always keep these four stable IDs; labels and times can be edited project-wide. Sessions cannot overlap and must remain within a single local day, with 24:00 allowed only as an end boundary.
- Provide previous/next navigation over five-day windows and a date picker within the project's shooting date range.
- Session cards form an ordered vertical list; their order is filming order.
- Show planned minutes and capacity. If lighting introduces waiting time, show that separately and include it in occupied time.
- Support moving a shot back to the unscheduled shelf.
- Do not infer simultaneous filming because a cell contains multiple shots.

### FR-7 — Suitability and constraints

Selecting or dragging a shot computes suitability for every visible date/session target.

- **Fits:** no blocking issues or unconfirmed required people.
- **Unconfirmed:** otherwise schedulable, but at least one required person's availability is unknown.
- **Blocked:** unavailable required people, session overflow, or an impossible lighting requirement.
- Show symbols and explanations alongside colors.
- A blocked drop does not mutate the schedule. Return the card to its original position and explain why.
- **Proposed default:** Unconfirmed targets allow tentative placement with a visible warning. No “force schedule” action bypasses a hard block.
- Without a selected shot, show actual schedule health rather than painting global person-specific exclusions.
- Distinguish a target that is blocked for the selected shot from a scheduled card that already has a conflict.

### FR-8 — Lighting

- Lighting is optional per shot: **anytime**, **daylight**, or **nighttime**. New shots default to anytime.
- **Proposed default:** The project has a manually configured daylight interval, initially 06:00–18:00, with date-specific overrides. This is a planning assumption, not an astronomical prediction.
- Check the estimated shot interval inside the session, not simply the session's label.
- A daylight shot may fit in the 17:00–20:00 session if it can finish by the configured daylight end.
- The UI labels the setting “Planning daylight window” and makes it editable.
- Do not equate the Night row with every possible nighttime interval; nighttime is the complement of the configured daylight interval.

### FR-9 — Project settings

- Edit the project title, shooting date range, production timezone, four session definitions, default daylight window, date-specific daylight overrides, and core crew.
- New date ranges are limited to the version-one supported size described in Section 8.
- Shortening a date range is blocked if it would leave assignments, availability overrides, or daylight overrides outside the range. Show affected records and require an explicit cleanup before applying.
- Session-time and daylight edits may expose conflicts. Preserve the schedule, apply the setting, and display the resulting issues.

### FR-10 — JSON exchange and reset

- Export the entire current project to a versioned JSON document.
- Suggested filename: `pakadbandi-<project-slug>-<export-date>.json`.
- Import validates the complete document before replacing state.
- Show an import preview with project name, date range, people count, shot count, and any schedule conflicts.
- Import replaces the active project; it does not merge projects.
- A valid project with scheduling conflicts can be imported and repaired. A structurally invalid project cannot be imported.
- Reset demo restores the untouched bundled fixture and clears selections and project editing history.
- Confirm import replacement and reset when edits have not been exported. Offer Export first, Continue, and Cancel.
- A best-effort browser leave warning is registered while unexported edits exist. It supplements the permanent export reminder; it does not promise recovery.

### FR-11 — Light and dark themes

- Both themes are release requirements, with identical functionality and information hierarchy.
- **Proposed default:** Theme menu options are Light, Dark, and System; first load follows System.
- Theme is page-session state in version one. Do not add localStorage just to remember it unless separately agreed.
- Apply the effective theme to the document root and update `color-scheme` for native controls.
- Use semantic CSS tokens for background, surface, text, border, focus ring, selected state, shot colors, and constraint states.
- Light theme: warm near-white surfaces, dark zinc text, pale yellow/sage/lavender shot cards.
- Dark theme: deep zinc surfaces, off-white text, muted amber/green/violet card surfaces; avoid copying bright pastel fills unchanged.
- Conflict colors, drag overlays, sheets, popovers, dialogs, and focus states must be verified in both themes.
- Theme changes never modify project data, clear selection, or reset drag-independent editing state.

## 5. Data and Interfaces

### Technology choices

| Layer | Proposed choice | Responsibility |
|---|---|---|
| Application | React + TypeScript + Vite | Client-side application and static build |
| Styling | Tailwind CSS + semantic CSS variables | Layout, responsive rules, theme tokens |
| UI primitives | shadcn/ui, one consistent primitive family | Buttons, fields, dialogs, sheets, popovers, tabs, menus, alerts |
| Board layout | Custom React components + CSS Grid | Date/session calendar and availability matrix |
| Dragging | dnd-kit React API | Drag lifecycle, targets, sorting integration |
| Project state | React reducer + split contexts | Single authoritative in-memory project |
| Validation | Zod | Runtime schemas for forms and files |
| Icons | Lucide React | Consistent line icons |
| Tests | Vitest, React Testing Library, Playwright | Domain, component, and browser coverage |

Use stable package releases verified together when scaffolding and commit the package lockfile. Do not mix snippets from incompatible major versions. In particular, current dnd-kit React documentation uses `@dnd-kit/react`; older `@dnd-kit/core` examples belong to a different API family. See the [current dnd-kit quickstart](https://dndkit.com/react/quickstart/).

shadcn documents a [Vite setup](https://ui.shadcn.com/docs/installation/vite) and [CSS-variable theming](https://ui.shadcn.com/docs/theming). Its [Vite theme-provider example](https://ui.shadcn.com/docs/dark-mode/vite) should be adapted to the session-only preference policy here.

### Canonical project model

The following defines the intended JSON domain. Runtime schemas remain the source of truth, with TypeScript types inferred where practical.

```ts
type ID = string;
type LocalDate = string; // Strict, real calendar date: YYYY-MM-DD.
type SessionId = "morning" | "afternoon" | "evening" | "night";
type AvailabilityStatus = "available" | "unavailable" | "unconfirmed";
type Lighting = "anytime" | "daylight" | "nighttime";
type ShotColor = "yellow" | "sage" | "lavender";

interface MinuteInterval {
  startMinute: number; // Integer, inclusive, 0..1439.
  endMinute: number;   // Integer, exclusive, 1..1440; greater than start.
}

interface SessionDefinition extends MinuteInterval {
  id: SessionId;
  label: string;
}

interface Person {
  id: ID;
  name: string;
  categories: Array<"cast" | "crew">;
  role: string;
  defaultAvailability: AvailabilityStatus;
}

interface Shot {
  id: ID;
  code: string;
  title: string;
  sceneLabel: string;
  description: string;
  locationLabel: string;
  requiredPersonIds: ID[];
  estimatedMinutes: number;
  lighting: Lighting;
  color: ShotColor;
}

interface AvailabilityOverride {
  personId: ID;
  date: LocalDate;
  sessionId: SessionId;
  status: AvailabilityStatus;
  note: string;
}

interface Assignment {
  shotId: ID;
  date: LocalDate;
  sessionId: SessionId;
  order: number; // Contiguous zero-based order within a session cell.
}

interface Project {
  id: ID;
  title: string;
  timezone: string; // Valid IANA identifier, default demo: Asia/Kolkata.
  startDate: LocalDate;
  endDate: LocalDate; // Inclusive.
  sessions: SessionDefinition[];
  daylightDefault: MinuteInterval;
  daylightByDate: Array<{ date: LocalDate; interval: MinuteInterval }>;
  coreCrewPersonIds: ID[];
  people: Person[];
  shots: Shot[];
  availability: AvailabilityOverride[];
  assignments: Assignment[];
}

interface ProjectFile {
  format: "pakadbandi-project";
  schemaVersion: 1;
  exportedAt: string; // ISO timestamp; export metadata, not shooting time.
  project: Project;
}
```

Assignments and availability use composite keys; duplicate keys are invalid. IDs are stable opaque values, generated independently of display names and shot codes. Theme, open dialogs, search text, selection, hover state, and computed conflicts are not exported.

### Application state and commands

Separate `ProjectState` from `UiState`:

- `ProjectState`: the project, load source (`demo` or `import`), and revision/export tracking.
- `UiState`: selected shot/person, calendar window, filters, dialog state, theme preference, and transient drag information.

Project mutations are typed reducer commands such as:

```ts
type ProjectCommand =
  | { type: "shot/create"; shot: Shot }
  | { type: "shot/update"; shot: Shot }
  | { type: "shot/delete"; shotId: ID }
  | { type: "person/create"; person: Person }
  | { type: "person/update"; person: Person }
  | { type: "person/delete"; personId: ID }
  | { type: "availability/set"; cells: AvailabilityOverride[] }
  | { type: "availability/clear"; keys: Array<{
      personId: ID; date: LocalDate; sessionId: SessionId;
    }> }
  | { type: "schedule/place"; shotId: ID; date: LocalDate;
      sessionId: SessionId; insertionIndex: number }
  | { type: "schedule/unschedule"; shotId: ID }
  | { type: "project/settings"; settings: Pick<Project,
      "title" | "timezone" | "startDate" | "endDate" | "sessions" |
      "daylightDefault" | "daylightByDate" | "coreCrewPersonIds"> }
  | { type: "project/replace"; project: Project; source: "demo" | "import" };
```

Validate commands at the domain boundary, not only in visible form controls. Schedule commands rerun placement validation against the current state so stale drag previews cannot commit an invalid placement. Rejection leaves the project unchanged and returns a user-facing explanation through the command handler.

### Domain interfaces

```ts
interface ScheduleIssue {
  code: "PERSON_UNAVAILABLE" | "PERSON_UNCONFIRMED" |
        "SESSION_OVERFLOW" | "LIGHTING_WINDOW";
  severity: "error" | "warning";
  shotId: ID;
  personId?: ID;
  date: LocalDate;
  sessionId: SessionId;
  message: string;
}

interface PlacementResult {
  status: "fits" | "unconfirmed" | "blocked";
  issues: ScheduleIssue[];
  timings: Array<{ shotId: ID; startMinute: number; endMinute: number }>;
  plannedMinutes: number;
  waitingMinutes: number;
  occupiedMinutes: number;
}

// Pure functions, with explicit project input:
// getRequiredPeople(project, shot): Person[]
// getAvailability(project, personId, date, sessionId): AvailabilityStatus
// evaluatePlacement(project, shotId, target, insertionIndex): PlacementResult
// evaluateSchedule(project): ScheduleIssue[]
// parseProjectFile(text): validated ProjectFile or structured errors
// serializeProject(project, exportedAt): string
```

No public server API is necessary in version one. File exchange is its external data contract.

### Validation rules

- Reject invalid dates, unsupported timezones, empty required text, non-finite numbers, negative durations, and invalid enum values.
- Durations are positive integer minutes, at most 1,440. A shot longer than a session may exist unscheduled and must explain why it cannot fit.
- Exactly four unique session IDs are required; intervals must not overlap.
- Project dates span 1–90 inclusive days. All dated project records lie within that range.
- Person IDs, shot IDs, and trimmed case-insensitive shot codes are unique within their relevant collections.
- All person and shot references resolve. Required-person and core-crew lists contain no duplicates.
- Each shot has zero or one assignment; assignment order is contiguous per cell.
- Availability composite keys and daylight override dates are unique.
- Limit proposed import size to 5 MiB before parsing. Limit projects to 500 shots and 200 people; at 90 days and four sessions, availability has at most 72,000 unique cells.
- Bound text lengths: 120 characters for names/titles/labels, 30 for shot codes, and 2,000 for descriptions and notes.
- Enforce the same 5 MiB limit on the canonical serialized project file during editing; reject an edit that would exceed it with a clear explanation. This keeps every supported working project exportable and reimportable under the same limit. Use UTF-8 byte size, not string character count, and account for the export envelope.
- Schema-version-one objects reject unknown fields to catch misspellings; do not quietly discard unfamiliar project data.
- Return useful errors with a path, for example `project.assignments[3].shotId: unknown shot`.
- Scheduling conflicts are semantic results, not structural import failures.

## 6. Flow and Logic

### Main planning flow

1. Open Pakadbandi; load demo data and resolve the system theme.
2. Review or edit shot requirements and people.
3. Mark availability in the person's matrix.
4. Select a shot; show suitability for the visible calendar cells.
5. Drag to a session or choose “Schedule shot” and select date/session/position.
6. Validate and commit the placement; update the shelf, ordered session list, occupancy, and conflicts together.
7. Export the current project when the user wants to retain it.

### Availability calculation

For a required person and target cell, use that cell's explicit override when present; otherwise use the person's default. The required-person set is the union of project core crew and shot-specific people, deduplicated by ID.

**Proposed default:** People must be available for the entire assigned session. Version one does not model “available only from 3:00 to 3:30” or person-specific arrival/departure times. This conservative rule is separate from a shot's estimated interval and should appear in the availability editor's help text.

One unavailable required person creates a hard block. An unconfirmed required person creates a warning. When both exist, the target is blocked, with both reasons available in its detail view.

### Ordered timing and lighting calculation

For each candidate placement:

1. Remove the moved shot from its current assignment in a temporary candidate schedule. This prevents double-counting, including moves within the same cell.
2. Insert at the target index. Reindex affected cells.
3. Start a time cursor at the session start.
4. For each shot in the resulting target order, find its allowed intervals:
   - Anytime: the session interval.
   - Daylight: the intersection of the session and configured daylight interval.
   - Nighttime: the intersections of the session with the portions before daylight start and after daylight end.
5. Starting at or after the cursor, choose the earliest allowed interval with enough contiguous time for the whole shot.
6. Account for any gap before that start as waiting. Advance the cursor to the shot end.
7. If there is insufficient remaining session time even without lighting restrictions, report session overflow. If ordinary remaining time is sufficient but no permitted contiguous interval fits, report a lighting-window issue.
8. Evaluate required people's whole-session availability independently of the timing calculation.
9. Evaluate the entire affected ordered cell, including later shots. An inserted shot can make a previously fitting later shot miss daylight.

Example: daylight ends at 18:00. A 45-minute daylight shot first in the 17:00–20:00 session occupies 17:00–17:45 and fits. If a preceding anytime shot lasts 30 minutes, the daylight shot would end at 18:15 and is blocked. A nighttime shot may start at 18:00, with the earlier unused hour shown as waiting if it is first in the session.

This is deterministic ordered placement, not optimization. The engine never rearranges the user's shots to find a better result. Manual shot start times and explicit breaks inside sessions are deferred; setup is included in estimates, and the session gaps remain outside capacity.

### Existing conflicts versus placement prevention

New placements cannot create hard conflicts in an otherwise valid affected cell. Editing availability, shot requirements, duration, or settings can invalidate already scheduled work. In that case:

- Keep every assignment where the planner put it.
- Mark affected cards and cells with clear issues.
- Show a conflict count and a navigable issue list.
- Let the user edit or unschedule affected shots to resolve the issue.
- An invalid cell may require removing a conflicting shot before inserting new work. Unscheduling is always permitted.
- Do not auto-move or silently delete assignments to make validation pass.

### State transitions

`Unscheduled → Scheduled` is a validated placement. `Scheduled → Scheduled` is a validated move/reorder. `Scheduled → Unscheduled` removes only the assignment. Conflict status and tentative status are derived from the current project; they are never separately stored as mutable shot fields.

Drag hover produces a preview only. Drop commits once. Escape, an outside drop, or a blocked drop restores the original state. Availability changes, filters, and theme changes never duplicate a shot.

### Date semantics

Store production dates as local calendar strings and times as integer wall-clock minutes. Midnight is the exclusive `1440` end boundary of the labeled day. Do not turn date-only values into UTC timestamps or shift them using the viewer's timezone.

The timezone names the production's local context. Version one measures planned wall-clock minutes; it does not calculate elapsed-time differences across daylight-saving transitions. Cross-midnight sessions beyond 24:00 are unsupported. If future scheduling requires such sessions or timezone conversion, that is a domain-model extension rather than a formatting change.

## 7. Edge Cases and Failure Handling

| Situation | Required behavior |
|---|---|
| Malformed or oversized JSON | Explain the error; keep the current project untouched |
| Unsupported format/version | Show supported version and reject; do not guess a conversion |
| Valid import contains scheduling conflicts | Preview conflict count, allow import, display issues |
| Import has duplicate IDs or unresolved references | Reject with record-level errors |
| User cancels file selection | Make no changes |
| File read fails | Preserve project and allow retry with another selection |
| Person becomes unavailable after scheduling | Preserve assignments and mark all affected shots |
| Duration/settings edit invalidates a cell | Preserve order, recompute, expose issue details |
| Drop outside any target or press Escape | Cancel without a project mutation |
| Reorder within a session | Remove original entry before evaluation; preserve uniqueness |
| No suitable session exists | Explain the constraints and keep the shot unscheduled |
| Long text or many required people | Truncate compact cards; full content remains accessible in details |
| Project has zero shots or people | Show useful empty states and creation actions |
| Required-person set is empty | Allow the shot; explain that no people requirements are specified |
| Invalid referenced person is deleted through a stale command | Reject at the domain boundary |
| System theme changes | Follow it only when theme preference is System |
| Refresh/tab closes | Current edits may be lost; export reminder and best-effort leave warning apply |

Import validation is atomic. Export constructs a fresh immutable snapshot, creates a browser download, and releases temporary object URLs. An unexpected render error shows a recovery message without automatically overwriting the in-memory project; recovery must not pretend that lost state can be restored.

## 8. Non-Functional Requirements

### Performance targets

These are proposed acceptance targets, to be measured rather than assumed:

- Typical dataset: 100 shots, 30 people, 30 shooting days.
- Supported upper bounds: 500 shots, 200 people, 90 days.
- Desktop placement-preview computation target: under 50 ms at the typical dataset size, measured in a production build.
- Typical edit-to-visible-feedback target: under 100 ms, excluding file dialogs and downloads.
- Render a five-day board window; do not mount every possible calendar cell for a long project.
- Memoize person/shot lookups, availability keys, assignments by cell, and derived results by project revision and candidate position.
- Keep high-frequency pointer movement out of the persistent project reducer.
- Add virtualization only if profiling establishes a need; do not introduce it before keyboard and drag behavior are stable.

### Reliability

- Domain functions are pure and deterministic.
- One reducer owns project mutations; no parallel unsynchronized copies of the schedule.
- Immutable updates prevent changes to the original demo fixture.
- Export/import preserves domain data exactly, excluding export timestamp and transient UI state.
- No network is required for editing after application assets have loaded, but offline reopening is not promised.

### Accessibility

- Target WCAG 2.2 AA practices: text contrast, visible focus, usable control names, and full keyboard access.
- Provide a non-drag scheduling dialog and non-paint availability editor.
- Announce successful moves and rejected placements through a polite live region.
- Use native/table semantics where practical; only use an ARIA grid if its full keyboard interaction is implemented.
- Return focus to the invoking control when a dialog closes.
- Do not communicate availability using color alone. Add a status symbol and accessible date/session/person labels to cells.
- Respect reduced-motion preferences. Tooltips supplement accessible names rather than replace them.

### Responsive behavior

- Desktop, approximately 1280 px and wider: three-column shot shelf, calendar, and availability panel.
- Tablet: prioritize the calendar; open one side panel at a time.
- Phone: use a single-day schedule with previous/next day controls and sheets for shots and people. Use click-to-schedule as the primary interaction.
- All project-editing functions remain available at narrow widths, even when the layout differs from the desktop mockup.

### Security and privacy

- Render imported text as text; do not execute HTML, scripts, or imported configuration.
- Import/export is entirely local to the browser session.
- Do not collect telemetry or log full project content by default.
- Do not include contact details or real personal information in demo fixtures.
- No backend credentials or service-role keys are part of the application.

### Observability

Use development diagnostics and test-visible structured validation errors. There is no production analytics integration in version one. The production UI reports actionable errors without exposing stack traces or project dumps.

## 9. Dependencies and Constraints

### Component mapping

| Feature | shadcn building blocks | Custom work |
|---|---|---|
| Header | Button, Badge, Dropdown Menu, Tooltip | Branding and action wiring |
| Shot editor | Sheet/Dialog, Field, Input, Textarea, Select, Checkbox | Required-person picker and shot validation |
| Shot shelf | Input, Badge, Scroll Area | Shot card and filtered list |
| Calendar | Button, Popover, date picker components | Four-row board, targets, timing, ordered stacks |
| People panel | Avatar, Input, Sheet | Person list and availability matrix |
| Constraints | Alert, Badge, Tooltip | Issue aggregation and contextual explanations |
| Import/reset | Dialog, Alert Dialog, Button | Atomic file validation and replacement |
| Theme switch | Dropdown Menu, Button | Session-only ThemeProvider and semantic tokens |

The scheduling board is not the shadcn date-picker Calendar component. That component may choose dates; the film schedule needs custom cells and card lists.

### Proposed source organization

```text
src/
  app/
    App.tsx
    providers.tsx
  components/
    ui/                       # shadcn component source
    layout/
  features/
    shots/
    people/
    availability/
    schedule/
    project-settings/
    project-files/
    theme/
  domain/
    schema.ts
    commands.ts
    availability.ts
    scheduling.ts
    project-validation.ts
    dates.ts
  state/
    project-reducer.ts
    project-context.tsx
    ui-context.tsx
    selectors.ts
  data/
    demo-project.json
  styles/
    globals.css
    theme.css
tests/
  fixtures/
  e2e/
```

Domain modules import no React or browser DOM APIs. Feature components consume commands/selectors rather than directly changing JSON objects. Browser file operations stay in `project-files`.

### Operational constraints

Deployment is a static build on a host selected later. No hosting provider or publication action is approved by this specification. Keep the first version on a single application route; routing infrastructure is unnecessary until separate shareable pages are needed. Production asset loading and base-path configuration must be verified on the chosen host before release.

## 10. Rollout and Migration

### Version-one release

1. Agree on this specification and proposed defaults.
2. Implement locally with deterministic fixtures.
3. Review actual light and dark screenshots plus working interactions.
4. Complete the acceptance checks.
5. Select and publish to a static host when authorized.

JSON format versioning starts at `schemaVersion: 1`. Future readers either explicitly support an older version through a tested migration or reject it with an explanation. Do not silently rewrite a file's meaning. Keep representative exported fixtures in tests.

### Future Supabase path

Supabase is a candidate, not a version-one dependency. Its documentation describes a [Postgres database](https://supabase.com/docs/guides/database/overview) and [row-level access policies integrated with authentication](https://supabase.com/docs/guides/database/postgres/row-level-security).

A future design could map projects, people, shots, shot-person links, availability, and assignments into related tables. Stable IDs, explicit relationships, and a versioned file format preserve a useful foundation.

Before that integration, specify:

- Authentication and project membership.
- Owner/editor/viewer permissions and row-level policies.
- Saving and loading behavior, retries, and visible save state.
- Transaction boundaries for moving shots and reindexing assignments.
- Conflict handling when two editors change the same project.
- Migration/import of JSON projects into an account.
- A separate isolated demo mode that does not expose shared editable production data.

Keep reusable project loading/serialization and domain commands separate now. Do not build a speculative repository framework in version one. Supabase is not simply a replacement reducer: collaboration introduces authorization, asynchronous failures, transactions, and concurrency that require their own specification.

### Rollback

Retain the previous static build and its matching fixtures so a deployment can be reverted. JSON files remain user-owned; application rollback must not mutate exported files. Test supported file versions against any rollback candidate.

## 11. Acceptance Criteria

| ID | Given / When / Then |
|---|---|
| AC-1 | Given a fresh visit, when the app loads, then Pakadbandi branding, the populated demo, and the export reminder are visible without login. |
| AC-2 | Given either theme, when the user changes Light/Dark/System, then the complete UI updates without modifying project data or selection. |
| AC-3 | Given an unscheduled shot, when a user places it in a valid session, then it appears exactly once there and no longer in the unscheduled shelf. |
| AC-4 | Given SH 012 requires Ravi, when targeting September 20 afternoon or any September 24 session, then placement is blocked with Ravi named in the reason. |
| AC-5 | Given a new person with no overrides, when a shot requires them, then otherwise valid targets are unconfirmed rather than green. |
| AC-6 | Given an unconfirmed target, when placing a shot, then it is assigned tentatively with a visible warning. |
| AC-7 | Given a scheduled shot, when a required person becomes unavailable, then the assignment stays in place and the shot receives a conflict indicator. |
| AC-8 | Given a two-hour session, when an added shot makes ordered occupancy exceed 120 minutes, then the drop is rejected with unchanged assignments. |
| AC-9 | Given daylight ends at 18:00, when a 45-minute daylight shot is first in the 17:00 session, then it fits; after a 30-minute preceding shot, it is blocked. |
| AC-10 | Given a session with later daylight shots, when an insertion would invalidate one of them, then the entire proposed insertion is rejected. |
| AC-11 | Given a scheduled shot, when moving or reordering it, then its old assignment is excluded from candidate capacity and the final assignment remains unique. |
| AC-12 | Given all-day unavailability, when changing only the afternoon cell to available, then the other three sessions remain unavailable. |
| AC-13 | Given a person inherited through core crew, when scheduling any shot, then that person's availability participates in evaluation. |
| AC-14 | Given a populated edited project, when exporting and importing it, then all domain records and assignment order are preserved. |
| AC-15 | Given malformed JSON, duplicates, or missing references, when importing, then validation explains the error and leaves the active project unchanged. |
| AC-16 | Given structurally valid JSON with scheduling conflicts, when importing, then its preview reports the conflicts and the imported board exposes them. |
| AC-17 | Given unexported edits, when resetting or replacing the project, then the user can export first, cancel, or explicitly continue. |
| AC-18 | Given page-session edits, when refreshing and allowing navigation, then the initial demo returns; no prior project state is read from browser storage. |
| AC-19 | Given a keyboard-only user, when creating a shot, editing availability, and scheduling it, then all operations are possible without dragging. |
| AC-20 | Given a phone-sized viewport, when planning, then shot editing, availability editing, and single-day scheduling remain usable. |
| AC-21 | Given two browsers with different local timezones, when loading the same project, then production dates and session labels remain identical. |
| AC-22 | Given a referenced person or a date-range reduction that strands records, when applying the destructive edit, then the app explains the dependency and preserves valid references. |
| AC-23 | Given a canceled or invalid drag, when it ends, then domain data and unexported-change tracking remain unchanged. |

## 12. Implementation Plan

### Phase 1 — Foundation and schema

- Scaffold React/TypeScript/Vite and one consistent shadcn setup.
- Define design tokens and both themes, using Pakadbandi branding from the start.
- Implement the runtime schema, fixtures, date helpers, and structural validation.
- Implement project reducer, commands, and UI-state boundaries.

**Exit:** Valid demo renders in both themes; invalid project structures are rejected by tests.

### Phase 2 — Editable project and file exchange

- Build shot and person lists/forms, core crew settings, project settings, and empty states.
- Implement export, import preview, atomic replacement, and demo reset.
- Add revision/export indicators and replacement protection.

**Exit:** A complete project can be edited and round-tripped through JSON before dragging is introduced.

### Phase 3 — Availability and scheduling engine

- Build matrix editing and the accessible alternative.
- Implement availability resolution, ordered timings, daylight/nighttime intervals, and structured conflict results.
- Implement click-to-schedule and the four-session board.

**Exit:** Scheduling rules and conflict repair work through ordinary controls with passing domain tests.

### Phase 4 — Dragging and visual feedback

- Add drag overlays, cell highlighting, insertion positions, reorder behavior, cancellation, and shelf return.
- Reuse the exact command validation used by click-to-schedule.
- Add contextual explanation surfaces and live announcements.

**Exit:** Dragging changes only the interaction method, not the scheduling result or validation rules.

### Phase 5 — Responsive polish and release review

- Refine dark-theme colors, panel sizing, long-content behavior, phone/tablet layouts, and focus handling.
- Run browser acceptance flows and profile representative datasets.
- Capture actual screenshots in both themes for review.
- Produce deployment-ready static assets and usage instructions.

**Exit:** Acceptance criteria pass and the user reviews the actual built result before publication.

### Main risks and mitigations

| Risk | Mitigation |
|---|---|
| Availability assumed from missing input | New people start unconfirmed; explicit demo defaults |
| Dragging bypasses rule checks | Shared command boundary and pure placement evaluation |
| Lighting labels reject otherwise usable evening time | Evaluate ordered minute intervals |
| User mistakes demo editing for persistent saving | Permanent export wording and replacement warnings |
| Dark theme becomes an afterthought | Build tokens and test both themes from Phase 1 |
| Future backend assumptions overcomplicate the demo | Stable domain boundaries without premature service infrastructure |

## 13. Testing Plan

### Unit tests

Test real business invariants: availability defaults/overrides, required-person union, session overlap rejection, uniqueness, range validation, midnight boundaries, capacity, ordered lighting windows, waiting time, source removal during moves, and conflicts introduced by data changes. Verify deterministic results and no fixture mutation.

### Component/integration tests

Cover forms dispatching valid commands, dependency-aware deletion, availability bulk edits, rejected commands preserving state, import preview/replacement, export indicators, and theme changes preserving project state. Test text and keyboard behavior; avoid tests that merely reproduce styling implementation details.

### End-to-end tests

Use Playwright for the key planner journey: load demo → edit a shot → mark availability → attempt blocked placement → place successfully → reorder → export → reset → import. Cover both drag and non-drag paths, one narrow viewport, and both themes.

Run primary flows in Chromium, Firefox, and WebKit where the local/CI environment supports them. Record any untested target rather than claiming universal compatibility.

### Negative and failure tests

- Oversized, malformed, unsupported-version, duplicate-reference, and structurally inconsistent files.
- Valid projects with semantic scheduling conflicts.
- Stale placement commands, canceled drag, and canceled replacement.
- A shot that exceeds every session and an empty staffing requirement.
- Date changes across month/year boundaries and viewers in different timezones.
- Long content, zero records, and the supported dataset bounds.

### Visual and manual QA

Inspect actual browser screenshots for light/dark desktop and narrow layouts. Check contrast, clipping, overlays, menus, selected/drag states, unconfirmed/blocked distinctions, and readable shot colors. Verify keyboard focus and file downloads manually where browser automation cannot establish the full experience.

## 14. Assumptions and Open Questions

These are review items, not reasons to start building before agreement. The original scope and latest corrections take precedence over every proposed default below.

| ID | Proposed default / assumption | Risk | Decision owner |
|---|---|---|---|
| A-1 | One shooting unit, sequential shots, one session assignment per shot | Medium | Product owner |
| A-2 | People must be available for the whole session | Medium | Product owner |
| A-3 | Unconfirmed people permit tentative placement; unavailable people block it | Medium | Product owner |
| A-4 | Four stable session IDs with editable project-wide labels/times | Low | Product owner |
| A-5 | Manually configured daylight interval, initially 06:00–18:00 | Medium | Product owner |
| A-6 | Core crew can apply to every shot; all requirements resolve to named people | Low | Product owner |
| A-7 | Light/Dark/System; theme preference resets on refresh with the page | Low | Product owner |
| A-8 | No project persistence, including sessionStorage; export/import is the retention path | Low | Agreed scope |
| A-9 | Desktop-first layout, with complete task access through a simplified phone layout | Low | Product owner |
| A-10 | Supported bounds: 500 shots, 200 people, 90 days, 5 MiB JSON | Low | Product owner / implementer |
| A-11 | Setup is included in duration; no separate within-session breaks or manual start times | Medium | Product owner |

The highest-impact review choices are **A-2, A-3, and A-5**: whole-session staffing, tentative placement policy, and the manual daylight model. If any changes, update the relevant functional requirements, schema/rules, and acceptance criteria together.

**Open question:** Which static hosting provider should serve the finished website? Deferred until deployment; it does not block the local implementation after specification approval.

**Open question:** Does a future saved-project version need individual crew accounts or only a planner account? Deferred to a separate backend specification.

## 15. Definition of Done

### This specification deliverable

- [x] Correct Pakadbandi name and explicit light/dark support.
- [x] Latest demo-first, no-database requirement reflected throughout.
- [x] Detailed stack, UI responsibilities, data model, and command boundaries.
- [x] Explicit constraints, failure behavior, and measurable acceptance criteria.
- [x] Implementation/testing phases and future Supabase considerations.
- [x] Proposed defaults separated from agreed requirements.
- [ ] Product owner has reviewed and agreed to the specification.

### Future version-one implementation

- [ ] Functional requirements and accepted defaults implemented.
- [ ] Domain checks, type checking, linting, and production build pass.
- [ ] Key browser journeys and JSON round-trip checks pass.
- [ ] No project database, backend connection, or hidden persistence introduced.
- [ ] Actual light/dark screenshots and responsive interactions reviewed.
- [ ] Pakadbandi branding appears consistently with accurate demo/export wording.
- [ ] Known limitations documented and release criteria reviewed.
- [ ] Deployment completed only when separately authorized.

Implementation should begin after agreement on this document, with the approved revision retained as the baseline for any scope changes.
