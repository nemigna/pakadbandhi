import {
  createContext,
  useEffect,
  useState,
  useContext,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { loadCloudProject, saveCloudProject } from "../features/cloud-project";
import { errorMessage, type Project } from "../domain/schema";
import { createDemoProject } from "../data/demo";
import {
  projectReducer,
  initialState,
  type ProjectState,
  type Action,
} from "./project-reducer";
import { applyCommand, type ProjectCommand } from "../domain/commands";
const StateContext = createContext<ProjectState | null>(null);
const DispatchContext = createContext<{
  dispatch: React.Dispatch<Action>;
  commit: (command: ProjectCommand) => void;
} | null>(null);
const CloudContext = createContext<{
  ready: boolean;
  busy: boolean;
  message: string;
  saved: boolean;
  save: (secret: string) => Promise<void>;
} | null>(null);
export function useCloud() {
  return useContext(CloudContext);
}
export function ProjectProvider({
  children,
  enableCloud = false,
}: {
  children: ReactNode;
  enableCloud?: boolean;
}) {
  const [state, dispatch] = useReducer(projectReducer, undefined, () =>
    initialState(createDemoProject()),
  );
  const current = useRef(state);
  current.current = state;
  const [loading, setLoading] = useState(enableCloud);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [savedProject, setSavedProject] = useState<Project | null>(null);
  const version = useRef<string | null>(null);
  const saving = useRef(false);
  useEffect(() => {
    if (!enableCloud) return;
    let active = true;
    loadCloudProject()
      .then((data) => {
        if (!active) return;
        version.current = data.version;
        if (data.project) {
          dispatch({ type: "replace", project: data.project, source: "cloud" });
          // The reducer validates and clones the project; compare serialized contents below.
          setSavedProject(data.project);
        }
        setReady(true);
        setMessage(
          data.savedAt
            ? `Last cloud save: ${new Date(data.savedAt).toLocaleString()}`
            : "No cloud save yet. Save this project to begin.",
        );
      })
      .catch((error) => {
        if (active) setMessage(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enableCloud]);
  const save = async (secret: string) => {
    if (!ready || saving.current) throw new Error("Cloud saving is not ready.");
    saving.current = true;
    setBusy(true);
    const projectToSave = current.current.project;
    try {
      const result = await saveCloudProject(
        projectToSave,
        version.current,
        secret,
      );
      version.current = result.version;
      setSavedProject(projectToSave);
      setMessage(
        `Last cloud save: ${new Date(result.savedAt).toLocaleString()}`,
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const saved =
    savedProject !== null &&
    (savedProject === state.project ||
      JSON.stringify(savedProject) === JSON.stringify(state.project));
  const commit = (command: ProjectCommand) => {
    applyCommand(current.current.project, command);
    dispatch({ type: "command", command });
  };
  if (loading)
    return (
      <main className="cloud-loading" role="status">
        Loading cloud project…
      </main>
    );
  return (
    <CloudContext.Provider
      value={enableCloud ? { ready, busy, message, saved, save } : null}
    >
      <StateContext.Provider value={state}>
        <DispatchContext.Provider value={{ dispatch, commit }}>
          {children}
        </DispatchContext.Provider>
      </StateContext.Provider>
    </CloudContext.Provider>
  );
}
export function useProject() {
  const state = useContext(StateContext);
  if (!state) throw new Error("Missing project provider");
  return state;
}
export function useCommands() {
  const value = useContext(DispatchContext);
  if (!value) throw new Error("Missing command provider");
  return value;
}
