import type { Project, ProjectAsset } from "../data/types.ts";

/**
 * Gallery asset rendering (TASK-027, Sections 4.3 and 6.5).
 *
 * Renders one interactive tile per eligible manifest asset into #mosaic.
 * The build already guarantees the manifest contains only supported,
 * existing assets (0.txt and the featured image excluded), so the
 * renderer's job is faithful presentation and resilience: a broken
 * image degrades its own tile, never the gallery.
 *
 * A text file that shares an image's basename becomes that image's
 * caption (Section 4.3) rather than a separate tile.
 */

/** One composed tile: an image (optionally with a paired text caption), or a standalone text file. */
export type GalleryTile =
  | { kind: "image"; image: ProjectAsset; imageIndex: number; caption: ProjectAsset | null }
  | { kind: "text"; asset: ProjectAsset; assetIndex: number };

/** Basename without the final extension ("a.b.txt" → "a.b"). */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * Deterministic editorial composition (TASK-028, Section 6.5): tile
 * size classes repeat on fixed cycles, so the same project always
 * renders the same art-directed arrangement — varied sizes, occasional
 * full-width features, never per-render randomness.
 */
const IMAGE_SIZE_CYCLE = ["large", "small", "medium", "medium", "full"] as const;
const TEXT_SIZE_CYCLE = ["wide", "narrow"] as const;

/**
 * Group a project's assets into tiles, preserving the manifest's
 * deterministic filename order. A text asset pairs with the first
 * image sharing its basename — regardless of file order — and each
 * text asset captions at most one image; leftovers become text tiles.
 */
export function groupGalleryTiles(project: Project): GalleryTile[] {
  const imageBaseNames = new Set(
    project.assets
      .filter((asset) => asset.type === "image")
      .map((asset) => baseName(asset.name)),
  );
  // Pass 1: text assets sharing an image basename are caption candidates
  // (Section 4.3), so pairing works whether the text comes before or
  // after its image.
  const captionCandidates = new Set(
    project.assets.filter(
      (asset) => asset.type === "text" && imageBaseNames.has(baseName(asset.name)),
    ),
  );
  // Each candidate captions the first unused image with the same
  // basename; leftovers fall through as text tiles.
  const captionFor = new Map<ProjectAsset, ProjectAsset>();
  const usedCaptions = new Set<ProjectAsset>();
  for (const asset of project.assets) {
    if (asset.type !== "image" || !captionCandidates.size) continue;
    const caption =
      project.assets.find(
        (other) =>
          other.type === "text" &&
          captionCandidates.has(other) &&
          !usedCaptions.has(other) &&
          baseName(other.name) === baseName(asset.name),
      ) ?? null;
    if (caption !== null) {
      captionFor.set(asset, caption);
      usedCaptions.add(caption);
    }
  }

  const tiles: GalleryTile[] = [];
  project.assets.forEach((asset, assetIndex) => {
    if (asset.type === "text") {
      if (!usedCaptions.has(asset)) {
        tiles.push({ kind: "text", asset, assetIndex });
      }
      return;
    }
    tiles.push({
      kind: "image",
      image: asset,
      imageIndex: assetIndex,
      caption: captionFor.get(asset) ?? null,
    });
  });

  return tiles;
}

export type GalleryHandlers = {
  /** Activated with the image asset's index within project.assets. */
  onOpenImage: (assetIndex: number) => void;
  /** Activated with the text asset (its `path` feeds the viewer fetch). */
  onOpenText: (asset: ProjectAsset) => void;
};

/**
 * Populate #mosaic with `project`'s tiles. Clear-then-render: repeated
 * activation cannot duplicate the gallery. Tile clicks invoke the
 * handlers; the viewers themselves arrive in TASK-029/030.
 */
export function renderMosaic(
  doc: Document,
  project: Project,
  handlers: GalleryHandlers,
): void {
  const mosaic = doc.getElementById("mosaic");
  if (mosaic === null) return;

  let renderedImage = false; // the first image loads eagerly
  let imageOrdinal = 0;
  let textOrdinal = 0;
  mosaic.replaceChildren(
    ...groupGalleryTiles(project).map((tile) => {
      if (tile.kind === "image") {
        const size = IMAGE_SIZE_CYCLE[imageOrdinal % IMAGE_SIZE_CYCLE.length]!;
        imageOrdinal += 1;
        const element = createImageTile(doc, tile, renderedImage, size, handlers);
        renderedImage = true;
        return element;
      }
      const size = TEXT_SIZE_CYCLE[textOrdinal % TEXT_SIZE_CYCLE.length]!;
      textOrdinal += 1;
      return createTextTile(doc, tile, size, handlers);
    }),
  );
}

function createImageTile(
  doc: Document,
  tile: Extract<GalleryTile, { kind: "image" }>,
  alreadyRenderedImage: boolean,
  size: (typeof IMAGE_SIZE_CYCLE)[number],
  handlers: GalleryHandlers,
): HTMLElement {
  const figure = doc.createElement("figure");
  figure.className = `mosaic__tile mosaic__tile--image mosaic__tile--${size}`;

  const frame = doc.createElement("button");
  frame.type = "button";
  frame.className = "mosaic__frame";
  frame.setAttribute("aria-label", `Open image ${tile.image.name}`);

  const image = doc.createElement("img");
  image.className = "mosaic__image";
  image.src = tile.image.path;
  image.alt = tile.image.name; // the filename is the honest description
  image.decoding = "async";
  // Nonessential gallery images lazy-load (Section 8.4); the first tile
  // is usually in the initial viewport. setAttribute so the state is
  // observable even where the property is not reflected.
  image.setAttribute("loading", alreadyRenderedImage ? "lazy" : "eager");
  // A broken asset degrades to a labeled placeholder on its own tile
  // (Sections 6.5 and 8.3); the rest of the gallery is unaffected.
  image.addEventListener("error", () => {
    figure.classList.add("mosaic__tile--image-failed");
    const fallback = doc.createElement("span");
    fallback.className = "mosaic__fallback";
    fallback.textContent = `${tile.image.name} — image unavailable`;
    image.replaceWith(fallback);
  });

  frame.append(image);
  frame.addEventListener("click", () => handlers.onOpenImage(tile.imageIndex));
  figure.append(frame);

  if (tile.caption !== null) {
    const caption = doc.createElement("figcaption");
    caption.className = "mosaic__caption";
    caption.textContent = tile.caption.name;
    figure.append(caption);
  }
  return figure;
}

function createTextTile(
  doc: Document,
  tile: Extract<GalleryTile, { kind: "text" }>,
  size: (typeof TEXT_SIZE_CYCLE)[number],
  handlers: GalleryHandlers,
): HTMLElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = `mosaic__tile mosaic__tile--text mosaic__tile--${size}`;
  button.setAttribute("aria-label", `Open text file ${tile.asset.name}`);

  // The filename labels the tile (Section 4.3). No preview is fetched
  // here — text loads on demand in the viewer (Section 8.4).
  const name = doc.createElement("span");
  name.className = "mosaic__file-name";
  name.textContent = tile.asset.name;

  button.append(name);
  button.addEventListener("click", () => handlers.onOpenText(tile.asset));
  return button;
}
