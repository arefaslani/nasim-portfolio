import { renderIntro } from "./components/Intro.ts";
import { centerNewest, renderTimeline } from "./components/Timeline.ts";
import { loadAppData } from "./services/project-data.ts";

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
  // Project selection arrives with the state model (TASK-023); for now
  // selection is recorded so the timeline is exercisable.
  renderTimeline(document, appData.manifest, (projectId) => {
    console.info(`nasim-portfolio: project selected: ${projectId}`);
  });
  // Initial centering happens once, synchronously, before first paint.
  // The app never auto-centers again afterward (Section 6.1).
  centerNewest(document);
}
