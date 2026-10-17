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
