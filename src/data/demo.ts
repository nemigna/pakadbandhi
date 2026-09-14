import demoFile from "./demo-project.v1.json" with { type: "json" };
import { validateProject } from "../domain/schema";

// Keep each session independent from the bundled snapshot.
export const createDemoProject = () =>
  validateProject(structuredClone(demoFile.project));
