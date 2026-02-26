import { describe, expect, it, vi } from "vitest";

import { MockExternalCliRunner } from "./externalCliRunner";
import { DefaultPreviewExecutionService } from "./previewExecutionService";
import { PreviewOutputPublisher } from "./previewOutputPublisher";

describe("DefaultPreviewExecutionService", () => {
  it("resolves relative artifact path from cwd for existence check", async () => {
    const ensureArtifactExists = vi.fn(async () => true);
    const publisher: PreviewOutputPublisher = {
      computeOutputPath: () => "notes/sample.pdf",
      ensureArtifactExists,
    };
    const runner = new MockExternalCliRunner(async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }));
    const service = new DefaultPreviewExecutionService(runner, publisher, {
      cwd: "/vault",
    });

    const result = await service.executePreview(
      { filePath: "notes/sample.typ", displayName: "sample.typ" },
      "typst",
    );

    expect(ensureArtifactExists).toHaveBeenCalledWith("/vault/notes/sample.pdf");
    expect(result.artifactPath).toBe("notes/sample.pdf");
  });

  it("keeps absolute artifact path for existence check", async () => {
    const ensureArtifactExists = vi.fn(async () => true);
    const publisher: PreviewOutputPublisher = {
      computeOutputPath: () => "/vault/notes/sample.pdf",
      ensureArtifactExists,
    };
    const runner = new MockExternalCliRunner(async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }));
    const service = new DefaultPreviewExecutionService(runner, publisher, {
      cwd: "/vault",
    });

    const result = await service.executePreview(
      { filePath: "notes/sample.typ", displayName: "sample.typ" },
      "typst",
    );

    expect(ensureArtifactExists).toHaveBeenCalledWith("/vault/notes/sample.pdf");
    expect(result.artifactPath).toBe("/vault/notes/sample.pdf");
  });

  it("throws when preview process exits with non-zero code", async () => {
    const publisher: PreviewOutputPublisher = {
      computeOutputPath: () => "notes/sample.pdf",
      ensureArtifactExists: vi.fn(async () => true),
    };
    const runner = new MockExternalCliRunner(async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "compile failed",
    }));
    const service = new DefaultPreviewExecutionService(runner, publisher);

    await expect(
      service.executePreview(
        { filePath: "notes/sample.typ", displayName: "sample.typ" },
        "typst",
      ),
    ).rejects.toThrow("compile failed");
  });

  it("throws when artifact does not exist", async () => {
    const publisher: PreviewOutputPublisher = {
      computeOutputPath: () => "notes/sample.pdf",
      ensureArtifactExists: vi.fn(async () => false),
    };
    const runner = new MockExternalCliRunner(async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }));
    const service = new DefaultPreviewExecutionService(runner, publisher);

    await expect(
      service.executePreview(
        { filePath: "notes/sample.typ", displayName: "sample.typ" },
        "typst",
      ),
    ).rejects.toThrow("artifact not found");
  });
});
