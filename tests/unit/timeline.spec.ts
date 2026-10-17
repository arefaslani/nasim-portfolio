// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { renderTimeline, setActiveMarker } from "../../src/components/Timeline";
import { formatDate, isIsoDate } from "../../src/utils/dates";
import type { ProjectManifest } from "../../src/data/types";

const doc = document;

function makeManifest(projectIds: string[]): ProjectManifest {
  return {
    schemaVersion: 1,
    projects: projectIds.map((id) => ({
      id,
      date: id,
      description: `Project ${id}`,
      featuredImage: `projects/${id}/0.webp`,
      assets: [],
    })),
  };
}

beforeEach(() => {
  document.body.innerHTML = `
    <main><p id="empty-state" hidden></p></main>
    <nav><ol id="timeline"></ol></nav>
  `;
});

describe("renderTimeline", () => {
  it("renders one keyboard-operable marker per manifest entry, newest first", () => {
    renderTimeline(doc, makeManifest(["2026-12-03", "2026-11-20"]), () => {});
    const items = doc.querySelectorAll(".timeline__item");
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute("data-project-id")).toBe("2026-12-03");
    const marker = items[0]?.querySelector("button.timeline__marker");
    expect(marker?.getAttribute("type")).toBe("button");
    expect(marker?.getAttribute("aria-label")).toContain("Dec 3, 2026");
    expect(marker?.getAttribute("aria-label")).toContain("Project 2026-12-03");
  });

  it("renders the featured image and formatted date", () => {
    renderTimeline(doc, makeManifest(["2026-12-03"]), () => {});
    const image = doc.querySelector(".timeline__image") as HTMLImageElement;
    expect(image.getAttribute("src")).toBe("projects/2026-12-03/0.webp");
    expect(image.getAttribute("alt")).toBe("");
    expect(doc.querySelector(".timeline__date")?.textContent).toBe("Dec 3, 2026");
  });

  it("shows the empty state and no markers when there are no projects", () => {
    renderTimeline(doc, { schemaVersion: 1, projects: [] }, () => {});
    expect(doc.querySelectorAll(".timeline__item")).toHaveLength(0);
    expect(doc.getElementById("empty-state")?.hidden).toBe(false);
  });

  it("replaces previous markers instead of duplicating", () => {
    renderTimeline(doc, makeManifest(["2026-12-03"]), () => {});
    renderTimeline(doc, makeManifest(["2026-11-20"]), () => {});
    expect(doc.querySelectorAll(".timeline__item")).toHaveLength(1);
    expect(doc.querySelector(".timeline__item")?.getAttribute("data-project-id")).toBe(
      "2026-11-20",
    );
  });

  it("invokes the selection callback with the project ID on click", () => {
    const selected: string[] = [];
    renderTimeline(doc, makeManifest(["2026-12-03"]), (id) => selected.push(id));
    (doc.querySelector(".timeline__marker") as HTMLButtonElement).click();
    expect(selected).toEqual(["2026-12-03"]);
  });

  it("marks the featured image for fallback on error", () => {
    renderTimeline(doc, makeManifest(["2026-12-03"]), () => {});
    const item = doc.querySelector(".timeline__item")!;
    const image = item.querySelector("img")!;
    image.dispatchEvent(new Event("error"));
    expect(item.classList.contains("timeline__item--image-failed")).toBe(true);
  });
});

describe("setActiveMarker", () => {
  it("marks exactly one marker active and clears on null", () => {
    renderTimeline(doc, makeManifest(["2026-12-03", "2026-11-20"]), () => {});
    setActiveMarker(doc, "2026-11-20");
    expect(doc.querySelectorAll(".timeline__item[data-active]")).toHaveLength(1);
    expect(
      doc.querySelector('.timeline__item[data-project-id="2026-11-20"]')?.hasAttribute("data-active"),
    ).toBe(true);
    setActiveMarker(doc, null);
    expect(doc.querySelectorAll(".timeline__item[data-active]")).toHaveLength(0);
  });

  it("handles unknown project IDs safely", () => {
    renderTimeline(doc, makeManifest(["2026-12-03"]), () => {});
    expect(() => setActiveMarker(doc, "1999-01-01")).not.toThrow();
    expect(doc.querySelectorAll(".timeline__item[data-active]")).toHaveLength(0);
  });
});

describe("date formatting", () => {
  it("formats real dates and rejects invalid ones to the ISO fallback", () => {
    expect(formatDate("2026-12-03")).toBe("Dec 3, 2026");
    expect(formatDate("2026-02-30")).toBe("2026-02-30"); // impossible date
    expect(isIsoDate("2026-12-03")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
  });
});
