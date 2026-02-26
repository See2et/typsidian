import { afterEach, describe, expect, it } from "vitest";

import { PreviewContextResolver } from "./previewContextResolver";

describe("PreviewContextResolver", () => {
  afterEach(() => {
    void 0;
  });

  it("returns active .typ target", () => {
    const targetFile = { path: "notes/sample.typ", extension: "typ" };
    const resolver = new PreviewContextResolver(() => targetFile);

    const result = resolver.resolveTargetForCommand();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected ok result");
    }
    expect(result.target).toMatchObject({
      filePath: "notes/sample.typ",
      displayName: "sample.typ",
    });
  });

it("accepts uppercase typ file extensions", () => {
    const targetFile = { path: "notes/sample.TYP", extension: "TYP" };
    const resolver = new PreviewContextResolver(() => targetFile);

    const result = resolver.resolveTargetForCommand();

    if (!result.ok) {
      throw new Error("Expected ok result");
    }

    expect(result.target.filePath).toBe("notes/sample.TYP");
  });

  it("returns NO_ACTIVE_TARGET when no file is active", () => {
    const resolver = new PreviewContextResolver(() => null);

    const result = resolver.resolveTargetForCommand();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failure result");
    }

    expect(result.reason).toBe("NO_ACTIVE_TARGET");
  });

  it("returns NO_ACTIVE_TARGET when active file is not typ", () => {
    const resolver = new PreviewContextResolver(() => ({
      path: "notes/readme.md",
      extension: "md",
    }));

    const result = resolver.resolveTargetForCommand();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failure result");
    }

    expect(result.reason).toBe("NO_ACTIVE_TARGET");
  });
});
