import {
  createContext,
  useContext,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
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
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, undefined, () =>
    initialState(createDemoProject()),
  );
  const current = useRef(state);
  current.current = state;
  const commit = (command: ProjectCommand) => {
    applyCommand(current.current.project, command);
    dispatch({ type: "command", command });
  };
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={{ dispatch, commit }}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
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
