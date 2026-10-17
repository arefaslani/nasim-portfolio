// Project-content validation CLI (TASK-006 scope: folder-name and
// file-name rules). Deeper project discovery arrives in TASK-007.
// Exit code 1 on any validation error, 0 otherwise.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidProjectDirName } from "../src/lib/validate.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const projectsDir = join(repoRoot, "projects");

const errors = [];
const warnings = [];

let entries;
try {
  entries = readdirSync(projectsDir, { withFileTypes: true });
} catch (error) {
  if (error.code === "ENOENT") {
    console.log("validate: no projects/ directory yet — nothing to validate.");
    process.exit(0);
  }
  throw error;
}

for (const entry of entries) {
  if (!entry.isDirectory()) {
    warnings.push(`Unexpected non-directory entry in projects/: ${entry.name}`);
    continue;
  }
  if (!isValidProjectDirName(entry.name)) {
    errors.push(
      `Invalid project folder name "${entry.name}" — expected a real calendar date as YYYY-MM-DD.`,
    );
  }
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  console.error(`validate: ${errors.length} error(s) found.`);
  process.exit(1);
}

console.log("validate: project folder names are valid.");
