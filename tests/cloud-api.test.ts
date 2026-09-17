// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleProject } from "../api/project";
import { createDemoProject } from "../src/data/demo";
const secret = "test-save-key-with-at-least-24-characters";
let stored: string | null;
let failures: number;
let writes: number;
const call = (method = "GET", body?: unknown, key = secret) =>
  handleProject(
    new Request("https://planner.test/api/project", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        Origin: "https://planner.test",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
beforeEach(() => {
  stored = null;
  failures = 0;
  writes = 0;
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-db-token");
  vi.stubEnv("PAKADBANDI_SAVE_KEY", secret);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      const command = JSON.parse(init.body);
      let result;
      if (command[0] === "GET")
        result = command[1].includes(":failed:") ? failures : stored;
      else if (command[1].includes("INCR")) result = ++failures;
      else {
        const version = stored ? JSON.parse(stored).version : "";
        result = version === command[4] ? 1 : 0;
        if (result === 1) {
          stored = command[5];
          writes++;
        }
      }
      return Response.json({ result });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("cloud project API", () => {
  it("loads legacy cloud data without writing and blocks legacy saves", async () => {
    const project = createDemoProject();
    const { props: _props, ...rest } = project;
    expect(_props).toEqual([]);
    const legacy = {
      ...rest,
      shots: rest.shots.map(({ propIds: _ids, ...shot }) => shot),
    };
    const version = "00000000-0000-4000-8000-000000000001";
    stored = JSON.stringify({
      project: legacy,
      version,
      savedAt: "2026-09-17T00:00:00.000Z",
    });
    const original = stored;
    const loaded = await (await call()).json();
    expect(loaded.project).toEqual(project);
    expect(stored).toBe(original);
    expect(writes).toBe(0);
    expect((await call("PUT", { project: legacy, version })).status).toBe(409);
    expect(stored).toBe(original);
    const withProps = {
      ...project,
      props: [{ id: "bag", name: "Red bag", notes: "" }],
    };
    expect((await call("PUT", { project: withProps, version })).status).toBe(
      200,
    );
    const saved = stored;
    const newVersion = JSON.parse(stored!).version;
    expect(
      (await call("PUT", { project: legacy, version: newVersion })).status,
    ).toBe(409);
    expect(stored).toBe(saved);
    expect(writes).toBe(1);
  });
  it("loads an empty database without seeding it", async () => {
    expect(await (await call()).json()).toEqual({
      project: null,
      version: null,
      savedAt: null,
    });
    expect(writes).toBe(0);
  });
  it("rejects wrong keys and rate-limits attempts without writes", async () => {
    for (let i = 0; i < 11; i++) await call("PUT", {}, "wrong");
    expect((await call("PUT", {}, "wrong")).status).toBe(429);
    expect(writes).toBe(0);
  });
  it("validates project data", async () => {
    expect((await call("PUT", { version: null, project: {} })).status).toBe(
      400,
    );
    expect(writes).toBe(0);
  });
  it("saves, loads, updates and rejects stale versions", async () => {
    const project = createDemoProject();
    const first = await call("PUT", { version: null, project });
    expect(first.status).toBe(200);
    const { version } = await first.json();
    const loaded = await (await call()).json();
    expect(loaded.project).toEqual(project);
    expect(loaded.version).toBe(version);
    expect((await call("PUT", { version: null, project })).status).toBe(409);
    expect(
      (
        await call("PUT", {
          version,
          project: { ...project, title: "Updated" },
        })
      ).status,
    ).toBe(200);
    expect((await call("PUT", { version, project })).status).toBe(409);
    expect(writes).toBe(2);
  });
  it("fails closed with missing configuration", async () => {
    vi.stubEnv("PAKADBANDI_SAVE_KEY", "");
    expect((await call("PUT", {})).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests and oversized payloads", async () => {
    const crossOrigin = new Request("https://planner.test/api/project", {
      method: "PUT",
      headers: { Origin: "https://other.test" },
    });
    expect((await handleProject(crossOrigin)).status).toBe(403);
    expect((await call("PUT", { extra: "x".repeat(4_000_001) })).status).toBe(
      413,
    );
    expect(writes).toBe(0);
  });
  it("returns a safe error on database failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new Error("sensitive upstream detail"),
    );
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive upstream detail");
  });
});
