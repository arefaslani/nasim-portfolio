import type { Project } from "../data/types.ts";
import { formatDate } from "../utils/dates.ts";
import { hideHoverCard } from "./HoverCard.ts";
import { setActiveMarker } from "./Timeline.ts";
import type { ViewStateManager } from "../services/view-state.ts";

/**
 * Project detail region (TASK-024): opens a project from the timeline
 * by revealing #project-detail with the active date. The intro/timeline
 * choreography is TASK-025, the close control TASK-026, and the mosaic
 * content TASK-027 — this task only guarantees correct, duplicate-free
 * selection.
 */

/**
 * Reveal the detail region for `project` and move focus to its date
 * heading. Safe to call repeatedly: the mosaic is cleared (its content
 * is rendered per activation in TASK-027), never appended to.
 */
export function showProjectDetail(doc: Document, project: Project): void {
  const section = doc.getElementById("project-detail");
  if (section === null) return;
  section.hidden = false;

  const heading = doc.getElementById("project-date");
  if (heading !== null) {
    heading.textContent = formatDate(project.date);
    // preventScroll: the intro/timeline scroll choreography (TASK-025)
    // owns any document movement; focus must not fight it.
    heading.focus({ preventScroll: true });
  }

  // Clear-then-render: repeated activation cannot duplicate the gallery.
  doc.getElementById("mosaic")?.replaceChildren();
}

/**
 * Subscribe the detail region to the view state: every project state
 * activates its marker, reveals the region, and hides the hover card
 * so it never lingers over the mosaic (TASK-022 note).
 */
export function initProjectDetail(
  doc: Document,
  state: ViewStateManager,
  projects: readonly Project[],
  hoverCard: HTMLElement,
): void {
  state.subscribe((next) => {
    if (next.mode !== "project") return;
    const project = projects.find((candidate) => candidate.id === next.projectId);
    if (project === undefined) return; // defensive; ids are pre-validated
    setActiveMarker(doc, next.projectId);
    showProjectDetail(doc, project);
    hideHoverCard(hoverCard);
  });
}
