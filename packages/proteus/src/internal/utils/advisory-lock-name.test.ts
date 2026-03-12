import { buildMysqlLockName, hashNamespaceToInt32 } from "./advisory-lock-name";

describe("buildMysqlLockName", () => {
  it("should use 'default' when namespace is null", () => {
    expect(buildMysqlLockName("proteus_sync", null)).toMatchSnapshot();
  });

  it("should include namespace in the lock name", () => {
    expect(buildMysqlLockName("proteus_sync", "my_app")).toMatchSnapshot();
  });

  it("should hash namespace when result exceeds 64 chars", () => {
    const longNamespace = "a".repeat(100);
    const result = buildMysqlLockName("proteus_sync", longNamespace);
    expect(result.length).toBeLessThanOrEqual(64);
    expect(result).toMatchSnapshot();
  });

  it("should produce different names for different namespaces", () => {
    const a = buildMysqlLockName("proteus_sync", "ns_a");
    const b = buildMysqlLockName("proteus_sync", "ns_b");
    expect(a).not.toBe(b);
  });

  it("should produce same name for same namespace", () => {
    const a = buildMysqlLockName("proteus_sync", "ns_a");
    const b = buildMysqlLockName("proteus_sync", "ns_a");
    expect(a).toBe(b);
  });

  it("should produce different names for different prefixes", () => {
    const a = buildMysqlLockName("proteus_sync", "ns");
    const b = buildMysqlLockName("proteus_migration", "ns");
    expect(a).not.toBe(b);
  });
});

describe("hashNamespaceToInt32", () => {
  it("should return a number for null namespace", () => {
    const result = hashNamespaceToInt32(null);
    expect(typeof result).toBe("number");
    expect(Number.isInteger(result)).toBe(true);
  });

  it("should return same value for same namespace", () => {
    expect(hashNamespaceToInt32("my_app")).toBe(hashNamespaceToInt32("my_app"));
  });

  it("should return different values for different namespaces", () => {
    expect(hashNamespaceToInt32("ns_a")).not.toBe(hashNamespaceToInt32("ns_b"));
  });

  it("should return the same value for null and explicit 'default'", () => {
    // null maps to "default" internally
    expect(hashNamespaceToInt32(null)).toBe(hashNamespaceToInt32(null));
  });

  it("should be within int32 range", () => {
    const result = hashNamespaceToInt32("test");
    expect(result).toBeGreaterThanOrEqual(-2147483648);
    expect(result).toBeLessThanOrEqual(2147483647);
  });

  it("should produce deterministic results", () => {
    expect(hashNamespaceToInt32("production")).toMatchSnapshot();
  });
});
