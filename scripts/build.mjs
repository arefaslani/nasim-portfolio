// Build pipeline (Section 5.1): validate content, generate the manifest,
// bundle TypeScript and CSS, assemble dist/index.html from the template,
// and copy project assets and the profile image.
//
// Usage: node scripts/build.mjs [--root <repoRoot>] [--out <distDir>] [--base <basePath>]
// Defaults: --root is this repository, --out <root>/dist, --base "" .
// Output is deterministic: no timestamps, fixed ordering throughout.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { discoverProjects } from "../src/lib/discover.ts";
import { buildManifest, normalizeBasePath, safeJsonForHtml } from "../src/lib/manifest.ts";
import { validateProfile, validateProfileImageResolves } from "../src/lib/profile.ts";

// --- Argument parsing -------------------------------------------------------
function parseArgs(argv) {
  const args = { root: undefined, out: undefined, base: "" };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--root") args.root = value;
    else if (flag === "--out") args.out = value;
    else if (flag === "--base") args.base = value;
    else throw new Error(`Unknown flag "${flag}"`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const defaultRoot = fileURLToPath(new URL("..", import.meta.url));
const root = (args.root ?? defaultRoot).replace(/\/$/, "");
const outDir = args.out ?? join(root, "dist");
const templateDir = join(defaultRoot, "src");

function fail(messages) {
  for (const message of messages) console.error(`build error: ${message}`);
  console.error("build: failed.");
  process.exit(1);
}

// --- 1. Profile configuration ----------------------------------------------
let profile;
{
  const profilePath = join(root, "content", "profile.json");
  let raw;
  try {
    raw = JSON.parse(readFileSync(profilePath, "utf8"));
  } catch (error) {
    fail([
      error.code === "ENOENT"
        ? "Missing profile configuration at content/profile.json."
        : `content/profile.json is not valid JSON: ${error.message}`,
    ]);
  }
  const validated = validateProfile(raw);
  if (validated.errors.length > 0) fail(validated.errors);
  profile = validated.profile;
  const imageErrors = validateProfileImageResolves(profile, (p) => existsSync(p), root);
  if (imageErrors.length > 0) fail(imageErrors);
}

// --- 2. Project discovery ---------------------------------------------------
const reader = {
  list: (dir) =>
    readdirSync(dir, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    })),
  readTextFile: (path) => readFileSync(path, "utf8"),
};

const discovered = discoverProjects(reader, join(root, "projects"));
const warnings = discovered.warnings.map((issue) => issue.message);
const errors = discovered.errors.map((issue) => issue.message);
if (errors.length > 0) fail(errors);
for (const message of warnings) console.warn(`build warning: ${message}`);

// --- 3. Manifest ------------------------------------------------------------
let basePath;
try {
  basePath = normalizeBasePath(args.base);
} catch (error) {
  fail([error.message]);
}
const manifest = buildManifest(discovered.projects, basePath);

// --- 4. Bundle TypeScript ---------------------------------------------------
const jsResult = await esbuild.build({
  entryPoints: [join(templateDir, "main.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  write: false,
  logLevel: "silent",
});
// Escape closing script tags so minified strings cannot terminate the
// inline <script> element.
const bundledJs = jsResult.outputFiles[0].text.replaceAll("</script>", "<\\/script>");

// --- 5. Bundle CSS ----------------------------------------------------------
const cssDir = join(templateDir, "styles");
const styleNames = existsSync(cssDir)
  ? readdirSync(cssDir).filter((name) => name.endsWith(".css")).sort()
  : [];
const bundledCss = styleNames
  .map((name) => readFileSync(join(cssDir, name), "utf8"))
  .join("\n")
  .replaceAll("</style>", "<\\/style>");

// --- 6. Assemble the final HTML --------------------------------------------
/** Escape text for interpolation into HTML elements and attributes. */
function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Function replacements avoid `$` sequences in bundled code being
// interpreted as replacement patterns.
const htmlTemplate = readFileSync(join(templateDir, "index.template.html"), "utf8");
const finalHtml = htmlTemplate
  .replaceAll("{{PAGE_TITLE}}", () => escapeHtml(profile.name))
  .replaceAll("{{PAGE_DESCRIPTION}}", () => escapeHtml(profile.headline))
  .replaceAll("{{BASE_PATH}}", () => basePath)
  .replaceAll("{{MANIFEST_JSON}}", () => safeJsonForHtml(manifest))
  .replaceAll("{{INLINE_CSS}}", () => bundledCss)
  .replaceAll("{{INLINE_JS}}", () => bundledJs);

// --- 7. Write output and copy assets ----------------------------------------
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"), finalHtml);

// Profile image.
const profileImageOut = join(outDir, profile.image);
mkdirSync(join(profileImageOut, ".."), { recursive: true });
cpSync(join(root, profile.image), profileImageOut);

// Project assets: exactly the files the manifest references (featured
// image + gallery assets). Unsupported and hidden files are excluded.
for (const project of manifest.projects) {
  const referenced = [project.featuredImage, ...project.assets.map((asset) => asset.path)];
  for (const deployedPath of referenced) {
    const relative = deployedPath.startsWith(`${basePath}/`)
      ? deployedPath.slice(basePath.length + 1)
      : deployedPath;
    const source = join(root, relative);
    const destination = join(outDir, relative);
    mkdirSync(join(destination, ".."), { recursive: true });
    cpSync(source, destination);
  }
}

console.log(
  `build: done — ${manifest.projects.length} project(s), output at ${outDir}`,
);
