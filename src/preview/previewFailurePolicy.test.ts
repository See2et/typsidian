import { describe, expect, it } from "vitest";

import { PreviewFailurePolicy } from "./previewFailurePolicy";

describe("PreviewFailurePolicy", () => {
  it("classifies missing runtime", () => {
    const policy = new PreviewFailurePolicy();
    const category = policy.classify(
      Object.assign(new Error("spawn typst ENOENT"), { code: "ENOENT" }),
      "fallback",
    );

    expect(category).toBe("DEPENDENCY_MISSING");
  });

  it("classifies timeout", () => {
    const policy = new PreviewFailurePolicy();
    const category = policy.classify(
      new Error("timeout while waiting for process"),
      "fallback",
    );

    expect(category).toBe("PROCESS_TIMEOUT");
  });

  it("classifies exit failure", () => {
    const policy = new PreviewFailurePolicy();
    const category = policy.classify(
      { exitCode: 3, stderr: "compile failed" },
      "fallback",
    );

    expect(category).toBe("PROCESS_EXIT_ERROR");
  });

  it("falls back for unknown errors", () => {
    const policy = new PreviewFailurePolicy();
    const category = policy.classify(new Error("unexpected"), "fallback");

    expect(category).toBe("PROCESS_FAILED_TO_START");
  });
});
