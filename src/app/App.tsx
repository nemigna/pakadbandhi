import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { DragDropProvider } from "@dnd-kit/react";
import {
  Clapperboard,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  Search,
  Plus,
  Settings2,
  CalendarDays,
  X,
  ArrowUpRight,
  CircleHelp,
  AlertTriangle,
  CheckCheck,
  Users,
  LayoutList,
  PanelLeftClose,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useProject, useCommands, useCloud } from "@/state/project-context";
import { createDemoProject } from "@/data/demo";
import { addDays, datesBetween, dateLabel } from "@/domain/dates";
import {
  errorMessage,
  type Shot,
  type Person,
  type Project,
  type SessionId,
} from "@/domain/schema";
import {
  cellAssignments,
  evaluatePlacement,
  evaluateSchedule,
  getRequiredPeople,
} from "@/domain/scheduling";
import { Board, Legend, ShelfDrop, ShotCard } from "@/features/board";
import { PaneResizer } from "@/features/pane-resizer";
import { PropsPage } from "@/features/props-page";
import { PeoplePanel } from "@/features/people-panel";
import {
  AvailabilityEditor,
  PersonEditor,
  ScheduleEditor,
  SettingsEditor,
  ShotEditor,
} from "@/features/editors";
import { downloadProject, readProjectFile } from "@/features/project-files";
import { CloudSave } from "@/features/cloud-save";
import { useTheme } from "@/features/theme";
type Modal =
  | { type: "shot"; shot?: Shot }
  | { type: "person"; person?: Person }
  | { type: "schedule"; shotId: string }
  | { type: "availability"; person: Person }
  | { type: "settings" }
  | { type: "issues" }
  | { type: "replace"; source: "demo" | "import"; project: Project }
  | null;
export function App() {
  const state = useProject();
  const cloud = useCloud();
  const { project } = state;
  const { commit, dispatch } = useCommands();
  const { theme, setTheme } = useTheme();
  const [page, setPage] = useState<"planner" | "props">("planner");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(
    () => project.people[0]?.id ?? null,
  );
  const [windowStart, setWindowStart] = useState(() => project.startDate);
  const [shotsOpen, setShotsOpen] = useState(true);
  const [peopleOpen, setPeopleOpen] = useState(true);
  const [shotsWidth, setShotsWidth] = useState<number>();
  const [peopleWidth, setPeopleWidth] = useState<number>();
  const schedulePanel = useRef<HTMLElement>(null);
  const [calendarWidth, setCalendarWidth] = useState<number>();
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setCalendarWidth(entry.contentRect.width);
    });
    if (schedulePanel.current) observer.observe(schedulePanel.current);
    return () => observer.disconnect();
  }, []);
  const [viewDays, setViewDays] = useState<5 | 7 | 9>(5);
  const [search, setSearch] = useState("");
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [mobileTab, setMobileTab] = useState("schedule");
  const [narrow, setNarrow] = useState(
    () => matchMedia("(max-width: 760px)").matches,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const dragSelection = useRef<string | null>(null);
  const [shelfFilter, setShelfFilter] = useState<"unscheduled" | "all">(
    "unscheduled",
  );
  const dirty = state.revision !== state.exportedRevision && !cloud?.saved;
  const currentDate =
    windowStart < project.startDate
      ? project.startDate
      : windowStart > project.endDate
        ? project.endDate
        : windowStart;
  const dayWidth = viewDays === 5 ? 142 : viewDays === 7 ? 126 : 112;
  const sessionWidth = viewDays === 5 ? 94 : viewDays === 7 ? 82 : 74;
  const displayedDays = narrow
    ? 1
    : ([9, 7, 5].find(
        (days) =>
          days <= viewDays &&
          (calendarWidth === undefined ||
            sessionWidth + dayWidth * days + 2 <= calendarWidth),
      ) ?? 5);
  const dates = datesBetween(
    currentDate,
    addDays(
      currentDate,
      narrow
        ? 0
        : Math.min(
            displayedDays - 1,
            Math.round(
              (Date.parse(project.endDate) - Date.parse(currentDate)) /
                86400000,
            ),
          ),
    ),
  );
  const selectedShot = project.shots.find((s) => s.id === selected);
  const selectedId = selectedShot?.id ?? null;
  const issues = useMemo(() => evaluateSchedule(project), [project]);
  const hardIssues = issues.filter((i) => i.severity === "error");
  const tentativeCount = new Set(
    issues.filter((i) => i.severity === "warning").map((i) => i.shotId),
  ).size;
  const unscheduled = project.shots.filter(
    (s) => !project.assignments.some((a) => a.shotId === s.id),
  );
  const visibleShots = (
    shelfFilter === "all" ? project.shots : unscheduled
  ).filter((s) =>
    [
      s.code,
      s.title,
      s.sceneLabel,
      s.locationLabel,
      ...getRequiredPeople(project, s).map((p) => p.name),
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const scheduleShotIds = useMemo(() => {
    const query = scheduleSearch.trim().toLowerCase();
    if (!query) return undefined;
    return new Set(
      project.shots
        .filter((shot) =>
          [
            shot.code,
            shot.title,
            shot.sceneLabel,
            shot.locationLabel,
            ...getRequiredPeople(project, shot).map((person) => person.name),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
        .map((shot) => shot.id),
    );
  }, [project, scheduleSearch]);
  const scheduleHasMatches = project.assignments.some(
    (assignment) =>
      dates.includes(assignment.date) &&
      (!scheduleShotIds || scheduleShotIds.has(assignment.shotId)),
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 760px)");
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    document.title = `Pakadbandi · ${project.title}`;
  }, [project.title]);
  const notify = (message: string) => setNotice(message);
  const exportProject = () => {
    try {
      downloadProject(project);
      dispatch({ type: "exported" });
      notify("Export started. Keep the JSON file to return to this project.");
    } catch (err) {
      notify(errorMessage(err));
    }
  };
  const schedule = (id: string) => {
    setSelected(id);
    setModal({ type: "schedule", shotId: id });
  };
  const selectShot = (id: string) => setSelected((x) => (x === id ? null : id));
  const place = (
    date: string,
    sessionId: SessionId,
    index?: number,
    shotId = selectedId,
  ) => {
    if (!shotId) return;
    try {
      const insertionIndex =
        index ??
        cellAssignments(project, date, sessionId).filter(
          (a) => a.shotId !== shotId,
        ).length;
      const result = evaluatePlacement(
        project,
        shotId,
        { date, sessionId },
        insertionIndex,
      );
      commit({
        type: "schedule/place",
        shotId,
        date,
        sessionId,
        insertionIndex,
      });
      notify(
        result.status === "unconfirmed"
          ? `Tentative placement: ${result.issues.map((i) => i.message).join("; ")}`
          : `${project.shots.find((s) => s.id === shotId)?.code} scheduled · ${dateLabel(date)} ${project.sessions.find((s) => s.id === sessionId)?.label}.`,
      );
    } catch (err) {
      notify(`Placement blocked. ${errorMessage(err)}`);
    }
  };
  const unschedule = (id = selectedId) => {
    if (!id) return;
    try {
      commit({ type: "schedule/unschedule", shotId: id });
      notify("Shot returned to the unscheduled shelf.");
    } catch (err) {
      notify(errorMessage(err));
    }
  };
  const replace = (next: Project, source: "demo" | "import") => {
    dispatch({ type: "replace", project: next, source });
    setSelected(null);
    setSelectedPerson(next.people[0]?.id ?? null);
    setWindowStart(next.startDate);
    setSearch("");
    setScheduleSearch("");
    setShelfFilter("unscheduled");
    setModal(null);
    notify(
      source === "demo"
        ? "Demo restored."
        : `${next.title} imported. Export to save changes.`,
    );
  };
  const nav = (amount: number) =>
    setWindowStart(
      addDays(currentDate, amount) < project.startDate
        ? project.startDate
        : addDays(currentDate, amount) > project.endDate
          ? project.endDate
          : addDays(currentDate, amount),
    );
  const themeIcon =
    theme === "light" ? (
      <Sun size={17} />
    ) : theme === "dark" ? (
      <Moon size={17} />
    ) : (
      <Monitor size={17} />
    );
  return (
    <DragDropProvider
      onDragStart={(event) => {
        dragSelection.current = selectedId;
        setSelected(String(event.operation.source?.data.shotId));
        setDragging(true);
      }}
      onDragEnd={(event) => {
        setDragging(false);
        const source = event.operation.source;
        const target = event.operation.target;
        if (event.canceled || !target || !source) {
          setSelected(dragSelection.current);
          return;
        }
        const id = String(source.data.shotId);
        const targetId = String(target.id);
        if (targetId === "shelf") {
          unschedule(id);
          return;
        }
        const [kind, date, session, position] = targetId.split("/");
        if (kind === "cell" || kind === "insert")
          place(
            date,
            session as SessionId,
            kind === "insert" ? Number(position) : undefined,
            id,
          );
      }}
    >
      <div className="app-shell">
        <header className="app-header">
          <a
            className="brand"
            href="/"
            onClick={(e) => e.preventDefault()}
            aria-label="Pakadbandi shooting planner"
          >
            <span className="brand-mark">
              <Clapperboard size={21} strokeWidth={1.6} />
            </span>
            <span>
              pakadbandi<span className="brand-period">.</span>
            </span>
          </a>
          <span className="header-divider" />
          <button
            className="project-title"
            onClick={() => setModal({ type: "settings" })}
          >
            <span>{project.title}</span>
            <ChevronDown size={14} />
          </button>
          <span className="demo-label">
            {state.source === "cloud"
              ? "CLOUD PROJECT"
              : state.source === "demo"
                ? "DEMO PROJECT"
                : "IMPORTED PROJECT"}
          </span>
          <div className="spacer" />
          <div className="header-actions">
            <CloudSave />
            <DropdownMenu
              trigger={
                <Button size="icon" variant="ghost" aria-label="Choose theme">
                  {themeIcon}
                </Button>
              }
              items={(["light", "dark", "system"] as const).map((t) => ({
                label: t[0].toUpperCase() + t.slice(1),
                checked: theme === t,
                action: () => setTheme(t),
              }))}
            />
            <Button
              className="reset-button"
              aria-label="Reset demo"
              variant="ghost"
              onClick={() =>
                setModal({
                  type: "replace",
                  source: "demo",
                  project: createDemoProject(),
                })
              }
            >
              <RotateCcw size={15} />
              <span>Reset demo</span>
            </Button>
            <Button
              className="import-button"
              aria-label="Import JSON"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={15} />
              <span>Import JSON</span>
            </Button>
            <Button
              variant="default"
              aria-label="Export JSON"
              onClick={exportProject}
            >
              <Download size={15} />
              <span>Export JSON</span>
            </Button>
          </div>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept=".json,application/json"
            aria-label="Import project JSON file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const imported = await readProjectFile(file);
                setModal({
                  type: "replace",
                  source: "import",
                  project: imported,
                });
              } catch (err) {
                notify(`Import failed. ${errorMessage(err)}`);
              }
            }}
          />
        </header>
        <div className="save-strip">
          <span>
            <span className="save-dot" />
            {cloud
              ? cloud.message
              : state.source === "demo"
                ? "Demo mode · Export to save."
                : "Imported project · Export to save changes."}
          </span>
          <span className={dirty ? "dirty" : "save-explanation"}>
            {cloud?.ready
              ? cloud.saved
                ? "Saved to cloud."
                : "Not saved to cloud."
              : dirty
                ? "Changes not exported."
                : "Your workspace lives in this tab."}
          </span>
        </div>
        <nav className="page-nav" aria-label="App pages">
          <button
            aria-current={page === "planner" ? "page" : undefined}
            onClick={() => setPage("planner")}
          >
            Planner
          </button>
          <button
            aria-current={page === "props" ? "page" : undefined}
            onClick={() => setPage("props")}
          >
            Props
          </button>
          {page === "planner" && (
            <div
              className="pane-visibility"
              role="group"
              aria-label="Planner panes"
            >
              <Button
                variant="ghost"
                aria-expanded={shotsOpen}
                aria-controls="shot-shelf"
                onClick={() => setShotsOpen((open) => !open)}
              >
                <LayoutList size={16} />
                {shotsOpen ? "Hide shot shelf" : "Show shot shelf"}
              </Button>
              <Button
                variant="ghost"
                aria-expanded={peopleOpen}
                aria-controls="cast-crew"
                onClick={() => setPeopleOpen((open) => !open)}
              >
                <Users size={16} />
                {peopleOpen ? "Hide cast & crew" : "Show cast & crew"}
              </Button>
            </div>
          )}
        </nav>
        {page === "props" && (
          <PropsPage
            key={project.id}
            onEditShot={(shot) => setModal({ type: "shot", shot })}
          />
        )}
        <div className="planner-page" hidden={page !== "planner"}>
          <nav className="mobile-nav" aria-label="Workspace panels">
            {[
              { id: "shots", title: "Shots", Icon: LayoutList },
              { id: "schedule", title: "Schedule", Icon: CalendarDays },
              { id: "people", title: "People", Icon: Users },
            ].map(({ id, title, Icon }) => (
              <button
                key={id}
                onClick={() => setMobileTab(id)}
                aria-current={mobileTab === id ? "page" : undefined}
              >
                <Icon size={16} />
                {title}
              </button>
            ))}
          </nav>
          <div
            style={
              {
                "--shots-width": shotsWidth ? `${shotsWidth}px` : undefined,
                "--people-width": peopleWidth ? `${peopleWidth}px` : undefined,
              } as CSSProperties
            }
            className={`workspace mobile-${mobileTab} ${shotsOpen ? "" : "shots-closed"} ${peopleOpen ? "" : "people-closed"} view-${viewDays}`}
          >
            <aside id="shot-shelf" className="shot-shelf">
              <PaneResizer side="left" onResize={setShotsWidth} />
              <div className="panel-heading">
                <div>
                  <h2>
                    Shot shelf{" "}
                    <span className="count-badge">{unscheduled.length}</span>
                  </h2>
                  <p>Ready to find their place</p>
                </div>
                <div className="pane-actions">
                  <Button
                    className="pane-toggle"
                    variant="ghost"
                    size="icon"
                    aria-label="Hide shots pane"
                    onClick={() => setShotsOpen(false)}
                  >
                    <PanelLeftClose size={17} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Create new shot"
                    onClick={() => setModal({ type: "shot" })}
                  >
                    <Plus size={19} />
                  </Button>
                </div>
              </div>
              <div className="search-field">
                <Search size={15} />
                <input
                  aria-label="Search shots"
                  placeholder="Search shots, people, locations…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="shelf-filter">
                <select
                  aria-label="Shot shelf filter"
                  value={shelfFilter}
                  onChange={(e) =>
                    setShelfFilter(e.target.value as typeof shelfFilter)
                  }
                >
                  <option value="unscheduled">Unscheduled shots</option>
                  <option value="all">All shots</option>
                </select>
                <span>{visibleShots.length}</span>
              </div>
              <ShelfDrop
                active={
                  !!project.assignments.find((a) => a.shotId === selectedId)
                }
                onUnschedule={() => unschedule()}
              >
                <div className="shot-list">
                  {visibleShots.map((shot) => (
                    <ShotCard
                      key={shot.id}
                      shot={shot}
                      selected={shot.id === selectedId}
                      onSelect={() => selectShot(shot.id)}
                      onEdit={() => setModal({ type: "shot", shot })}
                      onSchedule={() => schedule(shot.id)}
                      issues={issues.filter((i) => i.shotId === shot.id)}
                    />
                  ))}
                  {!visibleShots.length && (
                    <div className="empty-copy">
                      {search
                        ? "No shots match this search."
                        : "Every shot has a place. Add another shot when you’re ready."}
                    </div>
                  )}
                </div>
              </ShelfDrop>
              <Button
                className="add-shot"
                onClick={() => setModal({ type: "shot" })}
              >
                <Plus size={16} />
                New shot
              </Button>
              <div className="shelf-help">
                <CircleHelp size={15} />
                <p>
                  Select a shot to see where it fits.
                  <br />
                  Drag it, or use <strong>Schedule shot</strong>.
                </p>
              </div>
            </aside>
            <main ref={schedulePanel} className="schedule-panel">
              <div className="schedule-heading">
                <div>
                  <div className="eyebrow">PRODUCTION WORKSPACE</div>
                  <h1>Shooting schedule</h1>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Project settings"
                  onClick={() => setModal({ type: "settings" })}
                >
                  <Settings2 size={19} />
                </Button>
              </div>
              <div className="schedule-view-controls">
                <DropdownMenu
                  trigger={
                    <Button
                      variant="secondary"
                      aria-label="Change schedule view"
                    >
                      View:{" "}
                      {viewDays === 5
                        ? "Big"
                        : viewDays === 7
                          ? "Medium"
                          : "Small"}{" "}
                      ·{" "}
                      {displayedDays < viewDays
                        ? `${displayedDays} of ${viewDays}`
                        : viewDays}{" "}
                      days <ChevronDown size={14} />
                    </Button>
                  }
                  items={([5, 7, 9] as const).map((days) => ({
                    label: `${days === 5 ? "Big" : days === 7 ? "Medium" : "Small"} · ${days} days`,
                    checked: viewDays === days,
                    action: () => setViewDays(days),
                  }))}
                />
              </div>
              <div className="search-field schedule-search">
                <Search size={15} />
                <input
                  type="search"
                  aria-label="Search shooting schedule"
                  placeholder="Search scheduled shots, people, locations…"
                  value={scheduleSearch}
                  onChange={(event) => setScheduleSearch(event.target.value)}
                />
                {scheduleSearch && (
                  <button
                    aria-label="Clear schedule search"
                    onClick={() => setScheduleSearch("")}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {scheduleShotIds && !scheduleHasMatches && (
                <p className="schedule-search-empty" role="status">
                  No scheduled shots match this search in the displayed dates.
                </p>
              )}
              <div className="schedule-toolbar">
                <div className="date-navigation">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Previous dates"
                    disabled={currentDate <= project.startDate}
                    onClick={() => nav(-displayedDays)}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span>
                    {narrow
                      ? dateLabel(currentDate)
                      : `${dateLabel(dates[0])} – ${dateLabel(dates[dates.length - 1])}`}
                    <span className="date-year">
                      {" "}
                      {currentDate.slice(0, 4)}
                    </span>
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Next dates"
                    disabled={dates[dates.length - 1] >= project.endDate}
                    onClick={() => nav(displayedDays)}
                  >
                    <ChevronRight size={16} />
                  </Button>
                  <label className="jump-date" title="Jump to shooting date">
                    <CalendarDays size={15} />
                    <input
                      aria-label="Jump to shooting date"
                      type="date"
                      value={currentDate}
                      min={project.startDate}
                      max={project.endDate}
                      onChange={(e) => {
                        if (
                          e.target.value >= project.startDate &&
                          e.target.value <= project.endDate
                        )
                          setWindowStart(e.target.value);
                      }}
                    />
                  </label>
                </div>
                <span className="timezone-label">{project.timezone}</span>
              </div>
              <div
                className={`selection-strip ${selectedShot ? "has-selection" : ""}`}
              >
                {selectedShot ? (
                  <>
                    <span
                      className={`selection-swatch ${selectedShot.color}`}
                    />
                    <div>
                      <strong>{selectedShot.code}</strong>
                      <span>{selectedShot.title}</span>
                    </div>
                    <button
                      className="clear-selection"
                      aria-label="Clear selection"
                      onClick={() => setSelected(null)}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <span className="selection-empty">
                    Select a shot to check session suitability
                  </span>
                )}
                <div className="spacer" />
                <Legend />
              </div>
              <Board
                dates={dates}
                visibleShotIds={scheduleShotIds}
                density={
                  viewDays === 5 ? "big" : viewDays === 7 ? "medium" : "small"
                }
                selectedId={selectedId}
                dragging={dragging}
                onSelect={selectShot}
                onEdit={(shot) => setModal({ type: "shot", shot })}
                onSchedule={schedule}
                onPlace={place}
              />
              <footer className="schedule-footer">
                <span>
                  {project.assignments.length} of {project.shots.length} shots
                  scheduled
                </span>
                <span className="footer-progress">
                  <i
                    style={{
                      width: `${project.shots.length ? (project.assignments.length / project.shots.length) * 100 : 0}%`,
                    }}
                  />
                </span>
                <button
                  onClick={() => setModal({ type: "issues" })}
                  className={`health-button ${hardIssues.length ? "text-danger" : ""}`}
                >
                  {hardIssues.length ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <CheckCheck size={14} />
                  )}{" "}
                  {hardIssues.length
                    ? `${hardIssues.length} conflicts`
                    : "No conflicts"}
                  {tentativeCount > 0 ? ` · ${tentativeCount} tentative` : ""}
                  <ArrowUpRight size={12} />
                </button>
              </footer>
            </main>
            <PeoplePanel
              resizeHandle={
                <PaneResizer side="right" onResize={setPeopleWidth} />
              }
              onClose={() => setPeopleOpen(false)}
              dates={dates}
              selectedPerson={selectedPerson}
              onSelectPerson={setSelectedPerson}
              onEditPerson={(person) => setModal({ type: "person", person })}
              onAvailability={(person) =>
                setModal({ type: "availability", person })
              }
              notify={notify}
            />
          </div>
        </div>
        <footer className="app-footer">
          <span>
            PAKADBANDI <span> / </span> A little order. More room to create.
          </span>
          <span>One unit · Sequential filming</span>
        </footer>
        {(notice || state.error) && (
          <div className="toast" role="status" aria-live="polite">
            <span>{state.error || notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => {
                setNotice("");
                dispatch({ type: "clear-error" });
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {modal?.type === "shot" && (
          <ShotEditor
            shot={modal.shot}
            onClose={() => setModal(null)}
            onSchedule={schedule}
          />
        )}{" "}
        {modal?.type === "person" && (
          <PersonEditor person={modal.person} onClose={() => setModal(null)} />
        )}{" "}
        {modal?.type === "schedule" && (
          <ScheduleEditor
            shotId={modal.shotId}
            initialDate={currentDate}
            onClose={() => setModal(null)}
            notify={notify}
          />
        )}{" "}
        {modal?.type === "availability" && (
          <AvailabilityEditor
            person={modal.person}
            initialDate={currentDate}
            onClose={() => setModal(null)}
          />
        )}{" "}
        {modal?.type === "settings" && (
          <SettingsEditor onClose={() => setModal(null)} />
        )}{" "}
        {modal?.type === "issues" && (
          <Dialog
            title="Schedule health"
            description="Conflicts stay visible until you resolve their cause."
            onClose={() => setModal(null)}
          >
            {issues.length ? (
              <div className="issue-list">
                {issues.map((issue, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setWindowStart(issue.date);
                      setSelected(issue.shotId);
                      schedule(issue.shotId);
                    }}
                  >
                    <span
                      className={
                        issue.severity === "error"
                          ? "text-danger"
                          : "text-warning"
                      }
                    >
                      {issue.severity === "error" ? "×" : "?"}
                    </span>
                    <span>
                      <strong>
                        {project.shots.find((s) => s.id === issue.shotId)?.code}{" "}
                        · {dateLabel(issue.date)} ·{" "}
                        {
                          project.sessions.find((s) => s.id === issue.sessionId)
                            ?.label
                        }
                      </strong>
                      <small>{issue.message}</small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="healthy-state">
                <CheckCheck size={32} />
                <h3>Everything is in place.</h3>
                <p>
                  All scheduled shots fit their sessions and required people’s
                  availability.
                </p>
              </div>
            )}
          </Dialog>
        )}
        {modal?.type === "replace" && (
          <Dialog
            title={
              modal.source === "import"
                ? "Import project"
                : "Reset to the demo?"
            }
            description={
              modal.source === "import"
                ? "Review this file before replacing the active project."
                : "This restores the original shots, people, and schedule."
            }
            onClose={() => setModal(null)}
          >
            <div className="import-preview">
              <h3>{modal.project.title}</h3>
              <p>
                {dateLabel(modal.project.startDate)} –{" "}
                {dateLabel(modal.project.endDate)} · {modal.project.timezone}
              </p>
              <div>
                <span>{modal.project.shots.length} shots</span>
                <span>{modal.project.people.length} people</span>
                <span>{modal.project.assignments.length} scheduled</span>
              </div>
              <p>
                {
                  evaluateSchedule(modal.project).filter(
                    (i) => i.severity === "error",
                  ).length
                }{" "}
                conflicts ·{" "}
                {
                  evaluateSchedule(modal.project).filter(
                    (i) => i.severity === "warning",
                  ).length
                }{" "}
                warnings
              </p>
              {evaluateSchedule(modal.project)
                .slice(0, 5)
                .map((i, n) => (
                  <small key={n}>
                    {modal.project.shots.find((s) => s.id === i.shotId)?.code}:{" "}
                    {i.message}
                    <br />
                  </small>
                ))}
            </div>
            {dirty && (
              <div className="replacement-warning">
                <AlertTriangle size={18} />
                <div>
                  <strong>Changes not exported.</strong>
                  <p>
                    Export your current project before continuing if you want to
                    keep these edits.
                  </p>
                </div>
              </div>
            )}
            <div className="dialog-footer">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <div className="spacer" />
              {dirty && (
                <Button onClick={exportProject}>
                  <Download size={15} />
                  Export first
                </Button>
              )}
              <Button
                variant="default"
                onClick={() => replace(modal.project, modal.source)}
              >
                {dirty
                  ? "Continue"
                  : modal.source === "import"
                    ? "Import project"
                    : "Reset demo"}
              </Button>
            </div>
          </Dialog>
        )}
      </div>
    </DragDropProvider>
  );
}
