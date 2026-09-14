import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectProvider, useProject } from "../src/state/project-context";
import {
  PersonEditor,
  ShotEditor,
  AvailabilityEditor,
} from "../src/features/editors";
import { createDemoProject } from "../src/data/demo";
import { useState } from "react";
afterEach(cleanup);
function StateProbe() {
  const { project, revision } = useProject();
  return (
    <output data-testid="state">{JSON.stringify({ project, revision })}</output>
  );
}
function Harness({ mode }: { mode: "shot" | "person" | "availability" }) {
  const [open, setOpen] = useState(true);
  const demo = createDemoProject();
  return (
    <ProjectProvider>
      <StateProbe />
      {open &&
        (mode === "shot" ? (
          <ShotEditor onClose={() => setOpen(false)} onSchedule={() => {}} />
        ) : mode === "person" ? (
          <PersonEditor
            person={demo.people[0]}
            onClose={() => setOpen(false)}
          />
        ) : (
          <AvailabilityEditor
            person={demo.people[0]}
            initialDate="2026-09-24"
            onClose={() => setOpen(false)}
          />
        ))}
    </ProjectProvider>
  );
}
describe("Editing flows", () => {
  it("creates a complete shot and closes the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness mode="shot" />);
    await user.type(screen.getByLabelText("Shot code"), "SH 030");
    await user.type(screen.getByLabelText("Shot title"), "The return");
    await user.click(screen.getByRole("button", { name: "Create shot" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const state = JSON.parse(screen.getByTestId("state").textContent!);
    expect(state.project.shots.at(-1).code).toBe("SH 030");
    expect(state.revision).toBe(1);
  });
  it("exposes references and blocks deletion of a required person", () => {
    render(<Harness mode="person" />);
    expect(
      screen.getByRole("button", { name: "Delete person" }),
    ).toBeDisabled();
    expect(screen.getByText(/Referenced by:/)).toHaveTextContent("SH 01");
  });
  it("clears an all-day override with a default-status preview", async () => {
    const user = userEvent.setup();
    render(<Harness mode="availability" />);
    await user.selectOptions(
      screen.getByLabelText("Availability status"),
      "clear",
    );
    expect(screen.getByText(/Remove overrides from 4 cells/)).toHaveTextContent(
      "default: available",
    );
    await user.click(
      screen.getByRole("button", { name: "Apply availability" }),
    );
    const state = JSON.parse(screen.getByTestId("state").textContent!);
    expect(
      state.project.availability.filter(
        (a: { date: string; personId: string }) =>
          a.date === "2026-09-24" && a.personId === "ravi",
      ),
    ).toEqual([]);
  });
});
