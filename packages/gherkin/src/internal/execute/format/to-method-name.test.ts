import { describe, expect, test } from "vitest";
import { toMethodName } from "./to-method-name.js";

describe("toMethodName", () => {
  test("should camelCase the words around parameter slots", () => {
    expect(toMethodName("I encrypt {string} in record mode with aad {string}")).toBe(
      "iEncryptInRecordModeWithAad",
    );
  });

  test("should drop punctuation and lowercase the tail of each word", () => {
    expect(toMethodName("decrypting with AAD {string} is rejected!")).toBe(
      "decryptingWithAadIsRejected",
    );
  });

  test("should prefix a name starting with a digit", () => {
    expect(toMethodName("42 things happen")).toBe("step42ThingsHappen");
  });

  test("should fall back to step for an expression with no words", () => {
    expect(toMethodName("{string}")).toBe("step");
  });
});
