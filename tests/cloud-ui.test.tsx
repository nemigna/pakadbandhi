import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ProjectProvider,
  useCloud,
  useCommands,
  useProject,
} from "../src/state/project-context";
import { CloudSave } from "../src/features/cloud-save";
import { createDemoProject } from "../src/data/demo";
const version = "6df5b1e7-0334-41b8-8e94-55af8543c878";
const savedAt = "2026-09-16T00:00:00.000Z";
function Probe() {
  const cloud = useCloud()!;
  const { project } = useProject();
  const { dispatch } = useCommands();
  return (
    <>
      <h1>{project.title}</h1>
      <p>{cloud.message}</p>
      <output>{cloud.saved ? "cloud-saved" : "cloud-unsaved"}</output>
      <button
        onClick={() =>
          dispatch({
            type: "replace",
            source: "import",
            project: { ...project, title: "Newer local edit" },
          })
        }
      >
        Edit
      </button>
      <CloudSave />
    </>
  );
}
function setup() {
  render(
    <ProjectProvider enableCloud>
      <Probe />
    </ProjectProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("cloud workspace", () => {
  it("loads the cloud snapshot and clears the key after a rejected save", async () => {
    const user = userEvent.setup();
    const project = { ...createDemoProject(), title: "Cloud project" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ project, version, savedAt }))
      .mockResolvedValueOnce(
        Response.json(
          { error: "Incorrect save key. Nothing was saved." },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ version, savedAt }));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    expect(await screen.findByText("Cloud project")).toBeInTheDocument();
    expect(screen.getByText("cloud-saved")).toBeInTheDocument();
    await user.click(screen.getByText("Edit"));
    expect(screen.getByText("cloud-unsaved")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save to cloud" }));
    await user.type(screen.getByLabelText("Save key"), "wrong-key");
    await user.click(screen.getByRole("button", { name: "Save project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect save key",
    );
    expect(screen.getByLabelText("Save key")).toHaveValue("");
    await user.type(screen.getByLabelText("Save key"), "correct-key");
    await user.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("cloud-saved")).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
      "Bearer correct-key",
    );
  });
  it("keeps newer local changes unsaved when a save completes", async () => {
    const user = userEvent.setup();
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ project: null, version: null, savedAt: null }),
        )
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              finish = resolve;
            }),
        ),
    );
    setup();
    await user.click(
      await screen.findByRole("button", { name: "Save to cloud" }),
    );
    await user.type(screen.getByLabelText("Save key"), "key");
    await user.click(screen.getByRole("button", { name: "Save project" }));
    // Simulate another local state update while the network save is pending.
    screen.getByText("Edit").click();
    finish(Response.json({ version, savedAt }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("cloud-unsaved")).toBeInTheDocument();
  });
  it("preserves a usable local workspace when cloud loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Cloud offline")),
    );
    setup();
    expect(await screen.findByText("Cloud offline")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save to cloud" }),
    ).toBeDisabled();
    expect(screen.getByText("Edit")).toBeEnabled();
  });
});
