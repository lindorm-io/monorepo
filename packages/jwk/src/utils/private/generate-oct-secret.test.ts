import { HEADER_SYMBOL } from "../../constants";
import { generateOctSecret } from "./generate-oct-secret";

describe("generateOctSecret", () => {
  test("should return secret with header chars", () => {
    expect(generateOctSecret(32)).toStrictEqual(expect.stringContaining(HEADER_SYMBOL));
  });

  test("should return 4 header chars with length at 16", () => {
    const secret = generateOctSecret(16);

    expect(secret.length).toBe(16);
    expect(Buffer.from(secret, "utf-8").length).toBe(16);

    expect(secret.split("").filter((char) => char === HEADER_SYMBOL).length).toBe(4);
  });

  test("should return 4 header chars with length at 24", () => {
    const secret = generateOctSecret(24);

    expect(secret.length).toBe(24);
    expect(Buffer.from(secret, "utf-8").length).toBe(24);

    expect(secret.split("").filter((char) => char === HEADER_SYMBOL).length).toBe(4);
  });

  test("should return 4 header chars with length at 32", () => {
    const secret = generateOctSecret(32);

    expect(secret.length).toBe(32);
    expect(Buffer.from(secret, "utf-8").length).toBe(32);

    expect(secret.split("").filter((char) => char === HEADER_SYMBOL).length).toBe(4);
  });
});
