import {
  MAX_FILE_BYTES,
  parseProjectFile,
  serializeProject,
  type Project,
} from "../domain/schema";
export async function readProjectFile(file: File) {
  if (file.size > MAX_FILE_BYTES)
    throw new Error("JSON file exceeds the 5 MiB limit.");
  return parseProjectFile(await file.text()).project;
}
export function downloadProject(project: Project) {
  const now = new Date().toISOString();
  const text = serializeProject(project, now);
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  const slug =
    project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project";
  a.download = `pakadbandi-${slug}-${now.slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
