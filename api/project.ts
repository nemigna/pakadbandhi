import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
import { validateProject } from "../src/domain/schema.ts";

const MAX_BYTES = 4_000_000;
const saveSchema = z.strictObject({
  version: z.string().uuid().nullable(),
  project: z.unknown(),
});
const compareAndSave = `
local current = redis.call('GET', KEYS[1])
local version = ''
if current then version = cjson.decode(current).version end
if version ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1`;
const rateLimit = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 300) end
return count`;
const hash = (value: string) => createHash("sha256").update(value).digest();

export async function handleProject(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
): Promise<Response> {
  const respond = (status: number, body: unknown) =>
    Response.json(body, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  if (request.method !== "GET" && request.method !== "PUT")
    return new Response(null, { status: 405, headers: { Allow: "GET, PUT" } });
  const url = environment.UPSTASH_REDIS_REST_URL;
  const token = environment.UPSTASH_REDIS_REST_TOKEN;
  const secret = environment.PAKADBANDI_SAVE_KEY;
  const key = environment.PAKADBANDI_REDIS_KEY || "pakadbandi:project:v1";
  if (!url || !token || !secret || secret.length < 24)
    return respond(503, {
      error:
        "Cloud saving is not configured. Use JSON export to keep your work.",
    });
  const redis = async (command: (string | number)[]) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Database unavailable");
    const data = await response.json();
    if (data.error) throw new Error("Database command failed");
    return data.result;
  };
  try {
    if (request.method === "GET") {
      const stored = await redis(["GET", key]);
      if (stored === null)
        return respond(200, { project: null, version: null, savedAt: null });
      const data = JSON.parse(stored);
      return respond(200, {
        project: validateProject(data.project),
        version: z.string().uuid().parse(data.version),
        savedAt: z.iso.datetime().parse(data.savedAt),
      });
    }
    // No cookies or browser-stored credentials: every write requires an explicit key.
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return respond(403, { error: "Cross-origin saves are not allowed." });
    // Vercel overwrites this header with the connecting client's address.
    const ip = request.headers.get("x-vercel-forwarded-for") || "local";
    const bucket = `${key}:failed:${hash(ip).toString("hex")}`;
    if (Number(await redis(["GET", bucket])) > 10)
      return respond(429, {
        error: "Too many incorrect keys. Wait five minutes before retrying.",
      });
    const supplied =
      request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (!timingSafeEqual(hash(supplied), hash(secret))) {
      const attempts = await redis(["EVAL", rateLimit, 1, bucket]);
      return attempts > 10
        ? respond(429, {
            error:
              "Too many incorrect keys. Wait five minutes before retrying.",
          })
        : respond(401, { error: "Incorrect save key. Nothing was saved." });
    }
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return respond(415, { error: "Expected JSON." });
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES)
      return respond(413, {
        error: "Cloud saves are limited to 4 MB. Export JSON instead.",
      });
    let input;
    try {
      input = saveSchema.parse(JSON.parse(text));
      // Imports/reads accept legacy JSON; writes require the complete current shape.
      // This blocks old tabs before defaults could silently erase prop data.
      const shape = z
        .object({
          props: z.array(z.unknown()),
          shots: z.array(z.object({ propIds: z.array(z.string()) })),
        })
        .safeParse(input.project);
      if (
        !shape.success &&
        z.object({ shots: z.array(z.unknown()) }).safeParse(input.project)
          .success
      )
        return respond(409, {
          error:
            "This app version cannot safely save props. Export your edits, then reload the app and reapply your edits to the latest project. Nothing was saved.",
        });
      input.project = validateProject(input.project);
    } catch {
      return respond(400, {
        error: "Invalid project JSON. Nothing was saved.",
      });
    }
    const version = randomUUID();
    const savedAt = new Date().toISOString();
    const result = await redis([
      "EVAL",
      compareAndSave,
      1,
      key,
      input.version || "",
      JSON.stringify({ project: input.project, version, savedAt }),
    ]);
    if (result !== 1)
      return respond(409, {
        error:
          "The cloud project changed in another tab. Export your edits, then reload to get the latest version before saving again.",
      });
    return respond(200, { version, savedAt });
  } catch {
    return respond(503, {
      error:
        "Cloud request failed. Your edits are still in this tab; export JSON to keep them. If a save was interrupted, reload after exporting to check the cloud version.",
    });
  }
}

export default { fetch: (request: Request) => handleProject(request) };
