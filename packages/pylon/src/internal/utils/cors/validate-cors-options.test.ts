import { validateCorsOptions } from "./validate-cors-options";
import { describe, expect, test } from "vitest";

describe("validateCorsOptions", () => {
  test("should throw when allowOrigins is '*' and allowCredentials is true", () => {
    expect(() =>
      validateCorsOptions({ allowOrigins: "*", allowCredentials: true }),
    ).toThrow("Cannot set allowCredentials to true when allowOrigins is set to *");
  });

  test("should not throw when allowOrigins is '*' and allowCredentials is false", () => {
    expect(() =>
      validateCorsOptions({ allowOrigins: "*", allowCredentials: false }),
    ).not.toThrow();
  });

  test("should not throw when allowOrigins is a list and allowCredentials is true", () => {
    expect(() =>
      validateCorsOptions({
        allowOrigins: ["https://app.example.com"],
        allowCredentials: true,
      }),
    ).not.toThrow();
  });

  test("should not throw when no options are set", () => {
    expect(() => validateCorsOptions({})).not.toThrow();
  });
});
