import { computeHash } from "./compute-hash.js";
import { describe, expect, it } from "vitest";

describe("computeHash", () => {
  it("should produce deterministic hash", () => {
    const migration = {
      up: async () => {
        /* up */
      },
      down: async () => {
        /* down */
      },
    };
    const hash1 = computeHash(migration);
    const hash2 = computeHash(migration);
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe("string");
    expect(hash1.length).toBeGreaterThan(0);
  });

  it("should produce different hashes for different migrations", () => {
    const m1 = {
      up: async () => {
        /* a */
      },
      down: async () => {
        /* b */
      },
    };
    const m2 = {
      up: async () => {
        /* c */
      },
      down: async () => {
        /* d */
      },
    };
    expect(computeHash(m1)).not.toBe(computeHash(m2));
  });
});
