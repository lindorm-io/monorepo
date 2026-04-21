import { describe, expect, test } from "vitest";
import {
  cloneFilterRegistry,
  createFilterRegistry,
  disableFilter,
  enableFilter,
  setFilterParams,
} from "./filter-registry.js";

describe("createFilterRegistry", () => {
  test("should create an empty registry", () => {
    const registry = createFilterRegistry();
    expect(registry.size).toBe(0);
  });
});

describe("enableFilter", () => {
  test("should create entry when filter does not exist", () => {
    const registry = createFilterRegistry();
    enableFilter(registry, "active");
    expect(registry.get("active")).toEqual({ params: {}, enabled: true });
  });

  test("should enable an existing disabled filter", () => {
    const registry = createFilterRegistry();
    registry.set("active", { params: { status: "ok" }, enabled: false });
    enableFilter(registry, "active");
    expect(registry.get("active")).toEqual({ params: { status: "ok" }, enabled: true });
  });
});

describe("disableFilter", () => {
  test("should disable an existing enabled filter", () => {
    const registry = createFilterRegistry();
    registry.set("active", { params: {}, enabled: true });
    disableFilter(registry, "active");
    expect(registry.get("active")!.enabled).toBe(false);
  });

  test("should be a no-op for non-existent filter", () => {
    const registry = createFilterRegistry();
    disableFilter(registry, "nonExistent");
    expect(registry.size).toBe(0);
  });
});

describe("setFilterParams", () => {
  test("should create entry when filter does not exist", () => {
    const registry = createFilterRegistry();
    setFilterParams(registry, "tenant", { tenantId: "t-1" });
    expect(registry.get("tenant")).toEqual({
      params: { tenantId: "t-1" },
      enabled: true,
    });
  });

  test("should merge params into existing entry", () => {
    const registry = createFilterRegistry();
    registry.set("tenant", { params: { tenantId: "t-1" }, enabled: true });
    setFilterParams(registry, "tenant", { orgId: "o-1" });
    expect(registry.get("tenant")).toEqual({
      params: { tenantId: "t-1", orgId: "o-1" },
      enabled: true,
    });
  });

  test("should overwrite existing params with same key", () => {
    const registry = createFilterRegistry();
    registry.set("tenant", { params: { tenantId: "old" }, enabled: true });
    setFilterParams(registry, "tenant", { tenantId: "new" });
    expect(registry.get("tenant")!.params.tenantId).toBe("new");
  });

  test("should not mutate the input params object", () => {
    const registry = createFilterRegistry();
    const input = { tenantId: "t-1" };
    setFilterParams(registry, "tenant", input);
    input.tenantId = "mutated";
    expect(registry.get("tenant")!.params.tenantId).toBe("t-1");
  });
});

describe("cloneFilterRegistry", () => {
  test("should produce an independent copy", () => {
    const original = createFilterRegistry();
    original.set("active", { params: {}, enabled: true });
    original.set("tenant", { params: { tenantId: "t-1" }, enabled: false });

    const cloned = cloneFilterRegistry(original);

    expect(cloned.size).toBe(2);
    expect(cloned.get("active")).toEqual({ params: {}, enabled: true });
    expect(cloned.get("tenant")).toEqual({ params: { tenantId: "t-1" }, enabled: false });
  });

  test("should not share references with original", () => {
    const original = createFilterRegistry();
    original.set("tenant", { params: { tenantId: "t-1" }, enabled: true });

    const cloned = cloneFilterRegistry(original);

    // Mutate original
    original.get("tenant")!.params.tenantId = "mutated";
    original.get("tenant")!.enabled = false;

    // Clone should be unaffected
    expect(cloned.get("tenant")!.params.tenantId).toBe("t-1");
    expect(cloned.get("tenant")!.enabled).toBe(true);
  });

  test("should clone empty registry", () => {
    const original = createFilterRegistry();
    const cloned = cloneFilterRegistry(original);
    expect(cloned.size).toBe(0);
    expect(cloned).not.toBe(original);
  });
});
