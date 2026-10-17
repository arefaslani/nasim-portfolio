import { createHoverCard, enableHoverCards } from "./components/HoverCard.ts";
import { initProjectDetail } from "./components/ProjectDetail.ts";
import { renderIntro } from "./components/Intro.ts";
import {
  centerNewest,
  enableDragScrolling,
  enableWheelNavigation,
  renderTimeline,
} from "./components/Timeline.ts";
import { loadAppData } from "./services/project-data.ts";
import { createViewStateManager } from "./services/view-state.ts";

/**
 * Application entry point. The build embeds app data (manifest +
 * profile) into #app-data; everything renders from that.
 */
const appData = loadAppData();
if (appData === null) {
  // Fail soft: leave the designed empty shell visible.
  console.warn("nasim-portfolio: no embedded app data found.");
} else {
  renderIntro(document, appData.profile);

  // One explicit view state drives every region (Section 6.10).
  const state = createViewStateManager(
    appData.manifest.projects.map((project) => project.id),
  );
  const hoverCard = createHoverCard(document);

  // Project selection: markers open projects through the state model;
  // the subscription updates markers, the detail region, and overlays.
  initProjectDetail(document, state, appData.manifest.projects, hoverCard);
  renderTimeline(document, appData.manifest, (projectId) => {
    state.openProject(projectId);
  });

  // Initial centering happens once, synchronously, before first paint.
  // The app never auto-centers again afterward (Section 6.1).
  centerNewest(document);

  const scroller = document.querySelector<HTMLElement>(".timeline-scroller");
  if (scroller !== null) {
    enableWheelNavigation(scroller);
    enableDragScrolling(scroller);
    // Custom hover cards (TASK-022): one shared card outside the
    // scroller so the overflow container can never clip it.
    enableHoverCards(scroller, hoverCard, (projectId) =>
      appData.manifest.projects.find((project) => project.id === projectId),
    );
  }
}
