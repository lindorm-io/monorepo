import { randomSecret } from "@lindorm-io/random";
import { generateOctSecret } from "./generate-oct-secret";
import { isOctSecret } from "./is-oct-secret";

describe("isOctSecret", () => {
  test("should reject secret that does not contain header chars", () => {
    const secret = randomSecret(32);
    expect(isOctSecret(secret)).toBe(false);
  });

  test("should return secret with 4 header chars with length at 16", () => {
    const secret = generateOctSecret(16);
    expect(isOctSecret(secret)).toBe(true);
  });

  test("should return secret with 4 header chars with length at 24", () => {
    const secret = generateOctSecret(24);
    expect(isOctSecret(secret)).toBe(true);
  });

  test("should return secret with 4 header chars with length at 32", () => {
    const secret = generateOctSecret(32);
    expect(isOctSecret(secret)).toBe(true);
  });
});
