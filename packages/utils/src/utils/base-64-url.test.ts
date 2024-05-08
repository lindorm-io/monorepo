import { decodeBase64Url, encodeBase64Url } from "./base-64-url";

describe("base-64-url", () => {
  test("should encode base64Url", () => {
    expect(encodeBase64Url("hello there - general kenobi")).toEqual(
      "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ",
    );
  });

  test("should decode base64Url", () => {
    expect(decodeBase64Url("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ")).toEqual(
      "hello there - general kenobi",
    );
  });
});
