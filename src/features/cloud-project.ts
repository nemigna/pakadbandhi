import { z } from "zod";
import { projectSchema, type Project } from "../domain/schema";
const metadata = z.object({
  version: z.string().uuid(),
  savedAt: z.iso.datetime(),
});
const snapshot = z.union([
  metadata.extend({ project: projectSchema }),
  z.object({ project: z.null(), version: z.null(), savedAt: z.null() }),
]);
async function request(init?: RequestInit) {
  const response = await fetch("/api/project", {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "Cloud is unavailable here. Export your edits, then restart npm run dev or open the deployed app.",
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || "Cloud request failed. Export JSON to keep your edits.",
    );
  return result;
}
export async function loadCloudProject() {
  return snapshot.parse(await request());
}
export async function saveCloudProject(
  project: Project,
  version: string | null,
  secret: string,
) {
  const body = JSON.stringify({ project, version });
  if (new TextEncoder().encode(body).length > 4_000_000)
    throw new Error("Cloud saves are limited to 4 MB. Export JSON instead.");
  return metadata.parse(
    await request({
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body,
    }),
  );
}
