import type { ProjectManifest } from "../data/types.ts";
import { formatDate } from "../utils/dates.ts";

/**
 * Timeline component (TASK-018): renders one marker per manifest entry,
 * newest first (manifest order). Markers are buttons so they are keyboard
 * operable; the state model (TASK-023) supplies the selection callback.
 *
 * The timeline itself stays in the DOM with zero projects — the designed
 * empty state (Section 6.1) takes over instead.
 */

/** Marker width comes from CSS; keep them in sync via the same var. */

export function renderTimeline(
  doc: Document,
  manifest: ProjectManifest,
  onSelect: (projectId: string) => void,
): void {
  const list = doc.getElementById("timeline");
  if (list === null) return;

  list.replaceChildren();

  const emptyState = doc.getElementById("empty-state");
  const isEmpty = manifest.projects.length === 0;
  if (emptyState !== null) {
    emptyState.hidden = !isEmpty;
  }
  if (isEmpty) return;

  for (const project of manifest.projects) {
    list.append(createMarker(doc, project, onSelect));
  }
}

function createMarker(
  doc: Document,
  project: ProjectManifest["projects"][number],
  onSelect: (projectId: string) => void,
): HTMLLIElement {
  const item = doc.createElement("li");
  item.className = "timeline__item";
  item.dataset.projectId = project.id;

  const button = doc.createElement("button");
  button.type = "button";
  button.className = "timeline__marker";
  // The description is screen-reader-visible without needing hover.
  button.setAttribute("aria-label", `${formatDate(project.date)} — ${project.description}`);

  const image = doc.createElement("img");
  image.className = "timeline__image";
  image.src = project.featuredImage;
  image.alt = ""; // decorative; the aria-label carries the meaning
  image.loading = "eager"; // featured images are above the fold on the timeline
  image.decoding = "async";
  // Graceful fallback for broken featured images (Section 6.1).
  image.addEventListener("error", () => {
    item.classList.add("timeline__item--image-failed");
  });

  const date = doc.createElement("span");
  date.className = "timeline__date";
  date.textContent = formatDate(project.date);

  button.append(image, date);
  button.addEventListener("click", () => onSelect(project.id));
  item.append(button);
  return item;
}

/**
 * Active-marker state: visually distinct, one at a time (or none).
 * Unknown IDs clear the active state rather than throwing.
 */
export function setActiveMarker(doc: Document, projectId: string | null): void {
  const list = doc.getElementById("timeline");
  if (list === null) return;
  for (const item of list.querySelectorAll(".timeline__item[data-active]")) {
    item.removeAttribute("data-active");
  }
  if (projectId === null) return;
  // Project IDs are validated YYYY-MM-DD strings, so a direct dataset
  // comparison is safe (and avoids CSS.escape for older engines).
  const item = [...list.querySelectorAll(".timeline__item")].find(
    (element) => (element as HTMLElement).dataset.projectId === projectId,
  );
  item?.setAttribute("data-active", "true");
}

/**
 * Compute the scroll position that centers `item` in `container`
 * (TASK-019). Never negative: when the content is narrower than the
 * container, the timeline stays at its left edge.
 */
export function centeredScrollLeft(container: HTMLElement, item: HTMLElement): number {
  const target =
    item.offsetLeft - (container.clientWidth - item.offsetWidth) / 2;
  return Math.max(0, target);
}

/**
 * Center the newest project (the first marker) horizontally on initial
 * load (Section 6.1). Runs synchronously after render so the position is
 * set before first paint — no visible jump. Desktop only; the mobile
 * timeline is vertical (TASK-032). No-ops on an empty timeline.
 */
export function centerNewest(
  doc: Document,
  options: { isDesktop?: () => boolean } = {},
): void {
  const isDesktop = options.isDesktop ?? defaultIsDesktop;
  if (!isDesktop()) return;

  const container = doc.getElementById("timeline");
  if (container === null) return;
  const newest = container.querySelector<HTMLElement>(".timeline__item");
  if (newest === null) return;

  // Marker dimensions are fixed in CSS (not image-dependent), so layout
  // measurements are already final here.
  container.scrollLeft = centeredScrollLeft(container, newest);
}

function defaultIsDesktop(): boolean {
  return window.matchMedia("(min-width: 1024px)").matches;
}

/**
 * Wheel/trackpad navigation (TASK-020, Section 6.2).
 *
 * - Native horizontal gestures (trackpad deltaX, shift+wheel) are left to
 *   the browser.
 * - Vertical wheel movement over the timeline is translated into timeline
 *   scrolling — but only while the timeline can still scroll in that
 *   direction, so the page keeps scrolling normally at the edges.
 * - The listener is passive:false only where we may call preventDefault.
 *
 * Returns a cleanup function (Section 8.3).
 */
export function enableWheelNavigation(container: HTMLElement): () => void {
  function onWheel(event: WheelEvent): void {
    // Horizontal gestures scroll natively; nothing to translate.
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

    const atStart = container.scrollLeft <= 0;
    const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth;
    if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) {
      // Timeline is at its edge: hand the gesture back to page scrolling.
      return;
    }

    event.preventDefault();
    container.scrollLeft += event.deltaY;
  }

  container.addEventListener("wheel", onWheel, { passive: false });
  return () => container.removeEventListener("wheel", onWheel);
}
