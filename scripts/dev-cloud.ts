import { loadEnv, type Plugin } from "vite";
import { handleProject } from "../api/project.ts";

/** Serve the same server-only handler locally that Vercel serves in production. */
export function cloudApi(): Plugin {
  return {
    name: "pakadbandi-cloud-api",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, "");
      const configuration = Object.fromEntries(
        [
          "UPSTASH_REDIS_REST_URL",
          "UPSTASH_REDIS_REST_TOKEN",
          "PAKADBANDI_SAVE_KEY",
          "PAKADBANDI_REDIS_KEY",
        ].map((name) => [name, process.env[name] ?? env[name]]),
      );
      server.middlewares.use(async (incoming, outgoing, next) => {
        if (incoming.url?.split("?")[0] !== "/api/project") return next();
        outgoing.setHeader("Cache-Control", "no-store");
        outgoing.setHeader("Content-Type", "application/json");
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of incoming) {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += bytes.length;
            if (size > 4_000_000) {
              outgoing.statusCode = 413;
              outgoing.end(
                JSON.stringify({
                  error:
                    "Cloud saves are limited to 4 MB. Export JSON instead.",
                }),
              );
              return;
            }
            chunks.push(bytes);
          }
          const headers = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value !== undefined)
              headers.set(
                name,
                Array.isArray(value) ? value.join(", ") : value,
              );
          }
          headers.set(
            "x-vercel-forwarded-for",
            incoming.socket.remoteAddress || "local",
          );
          const method = incoming.method || "GET";
          const request = new Request(
            `http://${incoming.headers.host || "localhost:5173"}${incoming.url}`,
            {
              method,
              headers,
              ...(method === "GET" || method === "HEAD"
                ? {}
                : { body: Buffer.concat(chunks) }),
            },
          );
          const response = await handleProject(request, configuration);
          outgoing.statusCode = response.status;
          response.headers.forEach((value, name) =>
            outgoing.setHeader(name, value),
          );
          outgoing.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          outgoing.statusCode = 500;
          outgoing.end(
            JSON.stringify({
              error:
                "Local cloud API failed. Export your edits and restart the dev server.",
            }),
          );
        }
      });
    },
  };
}
