import { applyCommand, type ProjectCommand } from "../domain/commands";
import { errorMessage, validateProject, type Project } from "../domain/schema";
export interface ProjectState {
  project: Project;
  source: "demo" | "import" | "cloud";
  revision: number;
  exportedRevision: number;
  error: string | null;
}
export type Action =
  | { type: "command"; command: ProjectCommand }
  | { type: "replace"; project: Project; source: "demo" | "import" | "cloud" }
  | { type: "exported" }
  | { type: "clear-error" };
export const initialState = (project: Project): ProjectState => ({
  project,
  source: "demo",
  revision: 0,
  exportedRevision: 0,
  error: null,
});
export function projectReducer(
  state: ProjectState,
  action: Action,
): ProjectState {
  try {
    switch (action.type) {
      case "command": {
        const project = applyCommand(state.project, action.command);
        return {
          ...state,
          project,
          revision: state.revision + Number(project !== state.project),
          error: null,
        };
      }
      case "replace":
        return {
          ...initialState(validateProject(action.project)),
          source: action.source,
        };
      case "exported":
        return { ...state, exportedRevision: state.revision };
      case "clear-error":
        return { ...state, error: null };
    }
  } catch (error) {
    return { ...state, error: errorMessage(error) };
  }
}
