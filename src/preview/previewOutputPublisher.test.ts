import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PreviewOutputPublisher } from "./previewOutputPublisher";

let sandbox = "";

describe("PreviewOutputPublisher", () => {
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "typsidian-preview-"));
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });
  it("computes deterministic output path", () => {
    const publisher = new PreviewOutputPublisher();

    const target = { filePath: `${sandbox}/draft/sample.typ`, displayName: "sample.typ" };

    const artifactPath = publisher.computeOutputPath(target);

    expect(artifactPath).toBe(join(dirname(target.filePath), "sample.pdf"));
  });

  it("uses same output path for repeated compute", () => {
    const publisher = new PreviewOutputPublisher();
    const target = { filePath: `${sandbox}/draft/sample.typ`, displayName: "sample.typ" };

    const first = publisher.computeOutputPath(target);
    const second = publisher.computeOutputPath(target);

    expect(first).toBe(second);
  });

  it("confirms artifact existence", async () => {
    const publisher = new PreviewOutputPublisher();
    const target = { filePath: `${sandbox}/draft/sample.typ`, displayName: "sample.typ" };
    const artifact = publisher.computeOutputPath(target);
    mkdirSync(dirname(artifact), { recursive: true });
    writeFileSync(artifact, "pdf-content");

    expect(await publisher.ensureArtifactExists(artifact)).toBe(true);
    expect(statSync(artifact).isFile()).toBe(true);
  });
});
