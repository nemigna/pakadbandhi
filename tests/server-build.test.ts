// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

it("boots the emitted server entrypoint in plain Node, without Vite resolving imports", () => {
  const root = process.cwd();
  const output = mkdtempSync(join(tmpdir(), "pakadbandi-server-"));
  try {
    const config = ts.readConfigFile(
      join(root, "tsconfig.json"),
      ts.sys.readFile,
    ).config;
    const { options } = ts.convertCompilerOptionsFromJson(
      config.compilerOptions,
      root,
    );
    const visited = new Set<string>();
    function emit(file: string) {
      if (visited.has(file)) return;
      visited.add(file);
      const source = readFileSync(file, "utf8");
      for (const imported of ts.preProcessFile(source).importedFiles) {
        if (!imported.fileName.startsWith(".")) continue;
        const dependency = resolve(dirname(file), imported.fileName);
        emit(
          dependency.endsWith(".ts")
            ? dependency
            : dependency.replace(/\.js$/, "") + ".ts",
        );
      }
      const target = join(output, relative(root, file).replace(/\.ts$/, ".js"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(
        target,
        ts.transpileModule(source, {
          fileName: file,
          compilerOptions: { ...options, noEmit: false },
        }).outputText,
      );
    }
    emit(join(root, "api/project.ts"));
    writeFileSync(join(output, "package.json"), '{"type":"module"}');
    symlinkSync(
      join(root, "node_modules"),
      join(output, "node_modules"),
      "dir",
    );
    const entrypoint = pathToFileURL(join(output, "api/project.js")).href;
    const result = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      const { default: handler } = await import(${JSON.stringify(entrypoint)});
      const response = await handler.fetch(new Request('https://planner.test/api/project'));
      console.log(JSON.stringify({ status: response.status, type: response.headers.get('content-type') }));
    `,
      ],
      { encoding: "utf8", env: {}, timeout: 10_000 },
    );
    expect(JSON.parse(result)).toEqual({
      status: 503,
      type: "application/json",
    });
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
