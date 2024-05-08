import { decodeBase64, encodeBase64 } from "./base-64";

describe("base-64", () => {
  test("should encode base64", () => {
    expect(encodeBase64("hello there - general kenobi")).toEqual(
      "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==",
    );
  });

  test("should decode base64", () => {
    expect(decodeBase64("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==")).toEqual(
      "hello there - general kenobi",
    );
  });
});
