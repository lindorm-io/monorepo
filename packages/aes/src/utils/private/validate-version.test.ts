import { AesError } from "../../errors";
import { validateAesVersion } from "./validate-version";

describe("validateAesVersion", () => {
  test("should accept current version 1.0", () => {
    expect(validateAesVersion("1.0")).toBe("1.0");
  });

  test("should accept compatible minor version 1.1", () => {
    expect(validateAesVersion("1.1")).toBe("1.1");
  });

  test("should accept compatible minor version 1.99", () => {
    expect(validateAesVersion("1.99")).toBe("1.99");
  });

  test("should reject legacy integer version", () => {
    expect(() => validateAesVersion("12")).toThrow(AesError);
    expect(() => validateAesVersion("12")).toThrow(
      "Legacy AES version format is no longer supported",
    );
  });

  test("should reject legacy integer version 1", () => {
    expect(() => validateAesVersion("1")).toThrow(AesError);
    expect(() => validateAesVersion("1")).toThrow(
      "Legacy AES version format is no longer supported",
    );
  });

  test("should reject incompatible major version 2.0", () => {
    expect(() => validateAesVersion("2.0")).toThrow(AesError);
    expect(() => validateAesVersion("2.0")).toThrow("Incompatible AES version");
  });

  test("should reject incompatible major version 0.1", () => {
    expect(() => validateAesVersion("0.1")).toThrow(AesError);
    expect(() => validateAesVersion("0.1")).toThrow("Incompatible AES version");
  });

  test("should reject invalid format", () => {
    expect(() => validateAesVersion("abc")).toThrow(AesError);
    expect(() => validateAesVersion("abc")).toThrow("Invalid AES version format");
  });

  test("should reject triple segment version", () => {
    expect(() => validateAesVersion("1.0.0")).toThrow(AesError);
    expect(() => validateAesVersion("1.0.0")).toThrow("Invalid AES version format");
  });
});
