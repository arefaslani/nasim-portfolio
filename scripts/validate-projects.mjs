// Project-content validation CLI: discovers and validates everything under
// projects/ (TASK-006: folder/file name rules; TASK-007: full discovery).
// Exit code 1 on any validation error, 0 otherwise.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverProjects } from "../src/lib/discover.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const projectsDir = join(repoRoot, "projects");

const reader = {
  list: (dir) =>
    readdirSync(dir, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    })),
  readTextFile: (path) => readFileSync(path, "utf8"),
};

const { projects, errors, warnings } = discoverProjects(reader, projectsDir);

for (const { message } of warnings) {
  console.warn(`warning: ${message}`);
}

if (errors.length > 0) {
  for (const { message } of errors) {
    console.error(`error: ${message}`);
  }
  console.error(`validate: ${errors.length} error(s) found.`);
  process.exit(1);
}

if (projects.length === 0) {
  console.log("validate: no eligible projects found.");
} else {
  console.log(`validate: ${projects.length} project(s) discovered, all valid.`);
  for (const project of projects) {
    console.log(`  ${project.id} — "${project.description}" (${project.assets.length} gallery assets)`);
  }
}
