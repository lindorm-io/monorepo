import { applyNamespace } from "./apply-namespace.js";
import { describe, expect, it } from "vitest";

describe("applyNamespace", () => {
  it("should prefix the base with the namespace", () => {
    expect(applyNamespace("audit.request", "pylon")).toBe("pylon.audit.request");
  });

  it("should return the base unchanged when namespace is null", () => {
    expect(applyNamespace("audit.request", null)).toBe("audit.request");
  });

  it("should treat an empty namespace as no namespace", () => {
    expect(applyNamespace("audit.request", "")).toBe("audit.request");
  });
});
