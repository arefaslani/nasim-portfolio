// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  baseName,
  groupGalleryTiles,
  renderMosaic,
} from "../../src/components/ProjectGallery";
import { initProjectDetail } from "../../src/components/ProjectDetail";
import { createViewStateManager } from "../../src/services/view-state";
import type { Project, ProjectAsset } from "../../src/data/types";

const doc = document;

function asset(type: "image" | "text", name: string): ProjectAsset {
  return { type, name, path: `projects/2026-01-01/${name}`, mimeType: "image/png" };
}

function project(assets: ProjectAsset[]): Project {
  return {
    id: "2026-01-01",
    date: "2026-01-01",
    description: "Test project",
    featuredImage: "projects/2026-01-01/0.webp",
    assets,
  };
}

describe("baseName", () => {
  it("strips the final extension only", () => {
    expect(baseName("notes.txt")).toBe("notes");
    expect(baseName("a.b.png")).toBe("a.b");
    expect(baseName("retrospective.markdown")).toBe("retrospective");
  });

  it("returns names without extensions unchanged", () => {
    expect(baseName("no-extension")).toBe("no-extension");
  });
});

describe("groupGalleryTiles (Section 4.3 pairing)", () => {
  it("creates one tile per unpaired asset, in manifest order", () => {
    const tiles = groupGalleryTiles(
      project([asset("image", "dashboard.png"), asset("text", "notes.txt")]),
    );
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toMatchObject({ kind: "image", imageIndex: 0, caption: null });
    expect(tiles[1]).toMatchObject({ kind: "text", assetIndex: 1 });
  });

  it("pairs a text asset with a same-basename image as a caption, not a tile", () => {
    const tiles = groupGalleryTiles(
      project([asset("image", "diagram.png"), asset("text", "diagram.txt")]),
    );
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({
      kind: "image",
      imageIndex: 0,
      caption: { name: "diagram.txt", type: "text" },
    });
  });

  it("pairs case-insensitively on the basename across extensions", () => {
    const tiles = groupGalleryTiles(
      project([asset("image", "shot.webp"), asset("text", "shot.markdown")]),
    );
    expect(tiles[0]).toMatchObject({ kind: "image", caption: { name: "shot.markdown" } });
  });

  it("each text asset captions at most one image; unpaired candidates stay text tiles", () => {
    const tiles = groupGalleryTiles(
      project([
        asset("image", "a.png"),
        asset("text", "a.txt"),
        asset("image", "b.png"),
        asset("text", "a.md"),
      ]),
    );
    // a.txt pairs with a.png (same basename "a"); a.md and b.png have no
    // partner, so a.md stays a text tile and b.png is captionless.
    expect(tiles).toHaveLength(3);
    expect(tiles[0]).toMatchObject({ kind: "image", imageIndex: 0, caption: { name: "a.txt" } });
    expect(tiles[1]).toMatchObject({ kind: "image", imageIndex: 2, caption: null });
    expect(tiles[2]).toMatchObject({ kind: "text", assetIndex: 3 });
  });

  it("a text asset before its image still pairs (order-independent captions)", () => {
    const tiles = groupGalleryTiles(
      project([asset("text", "data.txt"), asset("image", "data.png")]),
    );
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ kind: "image", imageIndex: 1, caption: { name: "data.txt" } });
  });
});

describe("renderMosaic (TASK-027)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main><section id="project-detail"><div id="mosaic" class="mosaic"></div></section></main>
    `;
  });

  it("renders one interactive button per tile", () => {
    renderMosaic(
      doc,
      project([asset("image", "dashboard.png"), asset("text", "notes.txt")]),
      { onOpenImage: () => {}, onOpenText: () => {} },
    );
    const tiles = doc.querySelectorAll("#mosaic .mosaic__tile");
    expect(tiles).toHaveLength(2);
    expect(tiles[0]!.querySelector("button")).toBeInstanceOf(HTMLButtonElement);
    expect(tiles[1]).toBeInstanceOf(HTMLButtonElement);
  });

  it("labels image and text tiles accessibly (Section 6.5/7)", () => {
    renderMosaic(doc, project([asset("image", "dashboard.png"), asset("text", "notes.txt")]), {
      onOpenImage: () => {},
      onOpenText: () => {},
    });
    const frame = doc.querySelector("#mosaic .mosaic__frame")!;
    expect(frame.getAttribute("aria-label")).toBe("Open image dashboard.png");
    expect(doc.querySelector("#mosaic .mosaic__tile--text")!.getAttribute("aria-label")).toBe(
      "Open text file notes.txt",
    );
  });

  it("points images at the deployed path with honest alt text", () => {
    renderMosaic(doc, project([asset("image", "dashboard.png")]), {
      onOpenImage: () => {},
      onOpenText: () => {},
    });
    const image = doc.querySelector<HTMLImageElement>("#mosaic img")!;
    expect(image.getAttribute("src")).toBe("projects/2026-01-01/dashboard.png");
    expect(image.alt).toBe("dashboard.png");
  });

  it("lazy-loads later images but keeps the first eager (Section 8.4)", () => {
    renderMosaic(
      doc,
      project([asset("image", "a.png"), asset("image", "b.png"), asset("image", "c.png")]),
      { onOpenImage: () => {}, onOpenText: () => {} },
    );
    const images = [...doc.querySelectorAll<HTMLImageElement>("#mosaic img")];
    expect(images.map((image) => image.getAttribute("loading"))).toEqual([
      "eager",
      "lazy",
      "lazy",
    ]);
  });

  it("renders a paired caption beneath its image, not as a separate tile", () => {
    renderMosaic(doc, project([asset("image", "dashboard.png"), asset("text", "dashboard.txt")]), {
      onOpenImage: () => {},
      onOpenText: () => {},
    });
    const tiles = doc.querySelectorAll("#mosaic .mosaic__tile");
    expect(tiles).toHaveLength(1); // caption is not a tile
    const caption = tiles[0]!.querySelector(".mosaic__caption")!;
    expect(caption.textContent).toBe("dashboard.txt");
    // Caption text is untrusted content: textContent only, never markup.
    expect(caption.firstElementChild).toBeNull();
  });

  it("a broken image degrades its own tile and leaves the gallery intact", () => {
    renderMosaic(doc, project([asset("image", "broken.png"), asset("image", "fine.png")]), {
      onOpenImage: () => {},
      onOpenText: () => {},
    });
    const images = [...doc.querySelectorAll<HTMLImageElement>("#mosaic img")];
    images[0]!.dispatchEvent(new Event("error"));
    const figure = doc.querySelectorAll("#mosaic .mosaic__tile")[0]!;
    expect(figure.classList.contains("mosaic__tile--image-failed")).toBe(true);
    expect(figure.querySelector(".mosaic__fallback")?.textContent).toContain("broken.png");
    // The second tile is unaffected.
    expect(doc.querySelectorAll("#mosaic .mosaic__frame")).toHaveLength(2);
  });

  it("image tile clicks pass the asset index into project.assets", () => {
    const opened: number[] = [];
    renderMosaic(
      doc,
      project([asset("text", "notes.txt"), asset("image", "a.png"), asset("image", "b.png")]),
      { onOpenImage: (index) => opened.push(index), onOpenText: () => {} },
    );
    const frames = doc.querySelectorAll("#mosaic .mosaic__frame");
    (frames[0] as HTMLButtonElement).click(); // a.png — index 1 in project.assets
    (frames[1] as HTMLButtonElement).click(); // b.png — index 2
    expect(opened).toEqual([1, 2]);
  });

  it("text tile clicks pass the asset to the handler", () => {
    let opened: ProjectAsset | null = null;
    renderMosaic(doc, project([asset("text", "notes.txt")]), {
      onOpenImage: () => {},
      onOpenText: (a) => {
        opened = a;
      },
    });
    (doc.querySelector("#mosaic .mosaic__tile--text") as HTMLButtonElement).click();
    expect(opened).toMatchObject({ name: "notes.txt", path: "projects/2026-01-01/notes.txt" });
  });

  it("is idempotent: re-rendering never duplicates tiles", () => {
    const handlers = { onOpenImage: () => {}, onOpenText: () => {} };
    const testProject = project([asset("image", "a.png")]);
    renderMosaic(doc, testProject, handlers);
    renderMosaic(doc, testProject, handlers);
    expect(doc.querySelectorAll("#mosaic .mosaic__tile")).toHaveLength(1);
  });

  it("an empty asset list renders an empty mosaic without error", () => {
    expect(() => renderMosaic(doc, project([]), { onOpenImage: () => {}, onOpenText: () => {} })).not.toThrow();
    expect(doc.getElementById("mosaic")!.childElementCount).toBe(0);
  });
});

describe("gallery wiring through the state model", () => {
  const testProject = project([
    asset("image", "dashboard.png"),
    asset("text", "dashboard.txt"),
    asset("text", "notes.txt"),
  ]);

  beforeEach(() => {
    document.body.innerHTML = `
      <header id="intro"></header>
      <main>
        <section id="project-detail" hidden aria-labelledby="project-date">
          <div class="project-detail__header">
            <h2 id="project-date" tabindex="-1"></h2>
            <button id="close-project" type="button" aria-label="Close project and return to timeline"></button>
          </div>
          <div id="mosaic" class="mosaic"></div>
        </section>
      </main>
      <nav><div class="timeline-scroller"><ol id="timeline"></ol></div></nav>
      <div id="timeline-hover-card" data-visible="false"></div>
    `;
    document.body.dataset.mode = "overview";
  });

  /** Wiring as in initProjectDetail's subscription. */
  function setup() {
    const state = createViewStateManager([testProject.id]);
    const card = doc.getElementById("timeline-hover-card") as HTMLElement;
    initProjectDetail(doc, state, [testProject], card);
    return state;
  }

  it("opening a project renders its tiles; tile clicks transition the state model", () => {
    const state = setup();
    state.openProject(testProject.id);
    expect(doc.querySelectorAll("#mosaic .mosaic__tile")).toHaveLength(2); // image tile (with caption) + text tile

    (doc.querySelector("#mosaic .mosaic__frame") as HTMLButtonElement).click();
    expect(state.get()).toEqual({ mode: "image", projectId: testProject.id, assetIndex: 0 });

    (doc.querySelector("#mosaic .mosaic__tile--text") as HTMLButtonElement).click();
    // dashboard.txt became the image's caption; notes.txt is the text tile.
    expect(state.get()).toEqual({ mode: "text", projectId: testProject.id, assetPath: testProject.assets[2]!.path });
  });

  it("switching projects re-renders the mosaic without duplication", () => {
    const state = setup();
    state.openProject(testProject.id);
    state.openProject(testProject.id); // repeated activation
    expect(doc.querySelectorAll("#mosaic .mosaic__tile")).toHaveLength(2);
    // Close: the overview hides the region; no stale tiles remain.
    state.closeProject();
    expect(doc.getElementById("project-detail")?.hidden).toBe(true);
  });
});
