#!/usr/bin/env node
/**
 * Refresh openapi/openapi.json from the FastAPI app (no backend file changes).
 * Requires `uv` and backend dependencies: run from repo root or frontend-next/.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const backendRoot = path.resolve(frontendRoot, "..", "backend");
const outFile = path.join(frontendRoot, "openapi", "openapi.json");

const python = `
from app.main import create_app
import json
print(json.dumps(create_app().openapi(), indent=2))
`;

const result = spawnSync("uv", ["run", "python", "-c", python], {
  cwd: backendRoot,
  encoding: "utf8",
});

if (result.status !== 0) {
  console.error(result.stderr || "Failed to export OpenAPI from backend");
  process.exit(result.status ?? 1);
}

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, result.stdout, "utf8");
process.stdout.write(`Wrote ${outFile}\n`);
