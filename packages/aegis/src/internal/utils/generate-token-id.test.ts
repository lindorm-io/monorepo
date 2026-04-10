import { generateTokenId } from "./generate-token-id";

describe("generateTokenId", () => {
  test("returns a base64url string with 120 bits of entropy in 20 chars", () => {
    const id = generateTokenId();

    // 15 bytes (120 bits) base64url-encoded without padding = 20 chars
    expect(id).toHaveLength(20);
    // base64url charset: A-Z a-z 0-9 - _
    expect(id).toMatch(/^[A-Za-z0-9_-]{20}$/);
    // No padding on base64url output
    expect(id).not.toContain("=");
  });

  test("generates unique values across invocations", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateTokenId());
    }
    // Collision probability with 160-bit IDs across 1000 samples is
    // astronomically low (~10^-42). Any collision here indicates a bug.
    expect(ids.size).toBe(1000);
  });
});
