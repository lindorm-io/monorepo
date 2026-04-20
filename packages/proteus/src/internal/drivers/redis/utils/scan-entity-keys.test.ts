import { scanEntityKeys } from "./scan-entity-keys";
import { describe, expect, test, vi, type Mock } from "vitest";

// ─── Mock Redis Client ──────────────────────────────────────────────────────

type ScanResult = [cursor: string, keys: Array<string>];

const createMockRedisClient = (scanResults: Array<ScanResult>) => {
  let callIndex = 0;
  return {
    scan: vi.fn().mockImplementation(() => {
      const result = scanResults[callIndex];
      callIndex++;
      return Promise.resolve(result);
    }),
  };
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("scanEntityKeys", () => {
  test("should return keys from single scan iteration", async () => {
    const client = createMockRedisClient([["0", ["key1", "key2", "key3"]]]);

    const result = await scanEntityKeys(client as any, "entity:test:*");

    expect(result).toMatchSnapshot();
    expect(client.scan).toHaveBeenCalledTimes(1);
    expect(client.scan).toHaveBeenCalledWith(
      "0",
      "MATCH",
      "entity:test:*",
      "COUNT",
      1000,
    );
  });

  test("should loop through multiple scan iterations", async () => {
    const client = createMockRedisClient([
      ["42", ["key1", "key2"]],
      ["99", ["key3"]],
      ["0", ["key4"]],
    ]);

    const result = await scanEntityKeys(client as any, "entity:test:*");

    expect(result).toMatchSnapshot();
    expect(client.scan).toHaveBeenCalledTimes(3);
  });

  test("should deduplicate keys across iterations", async () => {
    const client = createMockRedisClient([
      ["42", ["key1", "key2"]],
      ["0", ["key2", "key3"]],
    ]);

    const result = await scanEntityKeys(client as any, "entity:test:*");

    expect(result).toMatchSnapshot();
    expect(result).toHaveLength(3);
  });

  test("should return empty array when no keys match", async () => {
    const client = createMockRedisClient([["0", []]]);

    const result = await scanEntityKeys(client as any, "entity:nonexistent:*");

    expect(result).toMatchSnapshot();
    expect(result).toHaveLength(0);
  });

  test("should handle empty intermediate iterations", async () => {
    const client = createMockRedisClient([
      ["42", ["key1"]],
      ["99", []],
      ["0", ["key2"]],
    ]);

    const result = await scanEntityKeys(client as any, "entity:test:*");

    expect(result).toMatchSnapshot();
    expect(result).toHaveLength(2);
  });
});
