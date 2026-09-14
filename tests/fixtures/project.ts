import fixture from "./demo-project.v1.json" with { type: "json" };
import { validateProject } from "../../src/domain/schema";

export const createTestProject = () =>
  validateProject(structuredClone(fixture.project));
