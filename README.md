# nasim-portfolio

A date-driven portfolio website: a chronological timeline of projects,
deployed to GitHub Pages. See `IMPLEMENTATION_PLAN.md` for the full design.

## Setup

```bash
npm install
npm run check   # validate + test + build
```

Requires Node 24 (any recent Node with native TypeScript support works).

## Commands

| Command | What it does |
| --- | --- |
| `npm run validate` | Validates `content/profile.json` and everything under `projects/` |
| `npm run test` | Runs unit and integration tests (vitest) |
| `npm run build` | Builds the site into `dist/` |
| `npm run check` | All of the above — what CI runs before deploying |

## Adding a project

1. Create a folder `projects/YYYY-MM-DD/` named with the project's date.
2. Add exactly one featured image named `0` with a supported image extension
   (`0.jpg`, `0.jpeg`, `0.png`, `0.webp`, `0.avif`, or `0.gif`).
3. Add a nonempty `0.txt` with a short description.
4. Add any other supported images (`.jpg/.jpeg/.png/.webp/.avif/.gif`) or
   text files (`.txt`, `.md`, `.markdown`) for the gallery.
5. Run `npm run validate` and `npm run build`, then commit and push.

No source-code changes are needed for an ordinary new project.

## Profile configuration

`content/profile.json`:

```json
{
  "name": "Your Name",
  "headline": "Engineer, builder, and curious human.",
  "intro": "A short introduction about who you are, what you build, and what interests you.",
  "image": "assets/profile.webp",
  "imageAlt": "Portrait of Your Name"
}
```

The image path is relative to the repository root and must point to a
supported image that exists.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) validates, tests, builds,
and publishes `dist/` on every push to `main`.

**Repository settings:** under Settings → Pages, set **Source** to
"GitHub Actions". The workflow declares the required
`pages: write` / `id-token: write` permissions itself.

**Base path:** the workflow builds with
`PORTFOLIO_BASE_PATH=/<repo-name>/`, matching the default
`https://<user>.github.io/<repo-name>/` URL. For a custom domain, change
that environment variable to an empty string (or pass `--base ""` locally)
and rebuild.
