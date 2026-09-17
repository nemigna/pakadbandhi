import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectProvider, useProject } from "../src/state/project-context";
import { PropsPage } from "../src/features/props-page";
import { ShotEditor } from "../src/features/editors";
import { useState } from "react";
import {
  type Shot,
  parseProjectFile,
  serializeProject,
  validateProject,
} from "../src/domain/schema";
import { applyCommand } from "../src/domain/commands";
import fixture from "./fixtures/demo-project.v1.json";
afterEach(cleanup);
it("loads legacy JSON without changing any existing fields and round-trips props", () => {
  const project = parseProjectFile(JSON.stringify(fixture)).project;
  expect(project.props).toEqual([]);
  expect(project.shots.every((shot) => shot.propIds.length === 0)).toBe(true);
  const { props: _props, ...legacy } = project;
  expect(_props).toEqual([]);
  expect({
    ...legacy,
    shots: legacy.shots.map(({ propIds: _ids, ...shot }) => shot),
  }).toEqual(fixture.project);
  let next = applyCommand(project, {
    type: "prop/create",
    prop: { id: "bag", name: "Red bag", notes: "" },
  });
  next = applyCommand(next, {
    type: "shot/update",
    shot: { ...next.shots[0], propIds: ["bag"] },
  });
  expect(parseProjectFile(serializeProject(next)).project).toEqual(next);
  const removed = applyCommand(next, { type: "prop/delete", propId: "bag" });
  expect(removed).toEqual(project);
  expect(() => validateProject({ ...next, props: [] })).toThrow("Unknown prop");
  expect(() =>
    validateProject({ ...next, props: [...next.props, next.props[0]] }),
  ).toThrow("Duplicate");
  expect(() =>
    validateProject({
      ...next,
      shots: [{ ...next.shots[0], propIds: ["bag", "bag"] }],
    }),
  ).toThrow();
});
function Harness() {
  const [shot, setShot] = useState<Shot>();
  const { project } = useProject();
  return (
    <>
      <PropsPage onEditShot={setShot} />
      {shot && (
        <ShotEditor
          shot={shot}
          onClose={() => setShot(undefined)}
          onSchedule={() => {}}
        />
      )}
      <output data-testid="project">{JSON.stringify(project)}</output>
    </>
  );
}
it("creates a prop, tags a shot, shows its scene, edits tags and deletes without changing scheduling", async () => {
  const user = userEvent.setup();
  render(
    <ProjectProvider>
      <Harness />
    </ProjectProvider>,
  );
  const before = JSON.parse(screen.getByTestId("project").textContent!);
  await user.click(screen.getByRole("button", { name: "New prop" }));
  await user.type(screen.getByLabelText("Prop name"), "Red bag");
  await user.click(screen.getByRole("button", { name: "Create prop" }));
  await user.type(screen.getByLabelText("Find shots"), before.shots[0].title);
  await user.click(
    screen.getByRole("checkbox", { name: new RegExp(before.shots[0].title) }),
  );
  expect(
    screen.getByRole("heading", { name: "Used in 1 shot" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", {
      name: before.shots[0].sceneLabel || "No scene label",
    }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Edit shot/ }));
  expect(screen.getByRole("checkbox", { name: "Red bag" })).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Red bag" }));
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(
    screen.getByRole("heading", { name: "Used in 0 shots" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Delete prop" }));
  await user.click(screen.getByRole("button", { name: "Confirm delete" }));
  expect(JSON.parse(screen.getByTestId("project").textContent!)).toEqual(
    before,
  );
});
