import { B64 } from "./b64";

describe("B64", () => {
  test("should encode base64", () => {
    expect(B64.encode("hello there - general kenobi")).toEqual(
      "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==",
    );
  });

  test("should encode base64Url", () => {
    expect(B64.encode("hello there - general kenobi", "base64url")).toEqual(
      "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ",
    );
  });

  test("should decode base64", () => {
    expect(B64.decode("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==")).toEqual(
      "hello there - general kenobi",
    );
  });

  test("should decode base64Url", () => {
    expect(B64.decode("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ")).toEqual(
      "hello there - general kenobi",
    );
  });
});
