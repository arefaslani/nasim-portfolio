import type { Project } from "../data/types.ts";
import { formatDate } from "../utils/dates.ts";
import type { ViewStateManager } from "../services/view-state.ts";

/**
 * Text viewer (TASK-030, Section 6.7): a modal dialog driven by the
 * state model's `text` mode. Content is fetched on demand from the
 * deployed static asset — never eagerly (Section 8.4) — and rendered
 * as plain text: untrusted project text must never be interpreted as
 * HTML or executed (Section 8.1), so only `textContent` is used.
 * Markdown renders as plain text in the first release (Section 4.3).
 *
 * Fetches are memoized per session: reopening the same document does
 * not refetch it (Section 6.7).
 */

export function initTextViewer(
  doc: Document,
  state: ViewStateManager,
  projects: readonly Project[],
): () => void {
  const dialog = doc.getElementById("text-viewer");
  if (!(dialog instanceof HTMLDialogElement)) return () => {};

  const title = dialog.querySelector<HTMLElement>("#text-viewer-title");
  const content = dialog.querySelector<HTMLElement>("#text-viewer-content");
  const closeButton = dialog.querySelector<HTMLButtonElement>(".viewer__close");
  if (content === null) return () => {};

  /** Session cache: path → fetched text (settled promise, so failures are cached too). */
  const cache = new Map<string, Promise<string>>();

  function loadText(path: string): Promise<string> {
    let entry = cache.get(path);
    if (entry === undefined) {
      entry = fetch(path).then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      });
      cache.set(path, entry);
    }
    return entry;
  }

  /** The gallery tile that opened the viewer (focus restore, 6.7). */
  let opener: HTMLElement | null = null;

  let loadToken = 0;

  const show = (project: Project, assetPath: string): void => {
    const asset = project.assets.find((candidate) => candidate.path === assetPath);
    if (asset === undefined || asset.type !== "text") return;

    const active = doc.activeElement;
    if (active instanceof HTMLElement && active.classList.contains("mosaic__tile--text")) {
      opener = active;
    }

    if (title !== null) {
      title.textContent = `${asset.name} — ${formatDate(project.date)}`;
    }

    // Loading state first; a slow or failed fetch must never leave the
    // previous document on screen (Section 6.7).
    const token = ++loadToken;
    dialog.classList.remove("text-viewer--error");
    content.textContent = "Loading…";

    loadText(asset.path).then(
      (text) => {
        if (token !== loadToken) return; // a newer open superseded this fetch
        content.textContent = text; // plain text only — never markup
      },
      () => {
        if (token !== loadToken) return;
        dialog.classList.add("text-viewer--error");
        content.textContent =
          "This document could not be loaded. It may be missing or unavailable — the viewer can be closed normally.";
      },
    );

    if (!dialog.open) {
      dialog.showModal();
      closeButton?.focus();
    }
  };

  const dismiss = (): void => {
    if (dialog.open) dialog.close(); // the close event below syncs the state
  };

  // DOM → state: any dismissal (Escape, close button, backdrop click)
  // lands in the close event (mirrors ImageViewer, TASK-031 unifies).
  dialog.addEventListener("close", () => {
    if (state.get().mode === "text") state.closeOverlay();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) state.closeOverlay();
  });

  closeButton?.addEventListener("click", () => state.closeOverlay());

  const unsubscribe = state.subscribe((next, previous) => {
    if (next.mode === "text") {
      const project = projects.find((candidate) => candidate.id === next.projectId);
      if (project === undefined) return; // defensive; ids are pre-validated
      show(project, next.assetPath);
      return;
    }
    if (previous?.mode === "text") {
      dismiss();
      // Focus returns to the opening tile when returning to that
      // project's detail (mirrors ImageViewer).
      if (next.mode === "project" && next.projectId === previous.projectId) {
        const target = opener;
        target?.focus({ preventScroll: true });
      }
      opener = null;
    }
  });

  return unsubscribe;
}
