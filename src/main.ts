import { renderIntro } from "./components/Intro.ts";
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
}
