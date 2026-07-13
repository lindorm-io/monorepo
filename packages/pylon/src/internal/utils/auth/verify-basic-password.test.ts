import { describe, expect, test } from "vitest";
import { verifyBasicPassword } from "./verify-basic-password.js";

describe("verifyBasicPassword", () => {
  test("should verify a matching password", () => {
    expect(verifyBasicPassword("secret", "secret")).toBe(true);
  });

  test("should reject a wrong password", () => {
    expect(verifyBasicPassword("wrong", "secret")).toBe(false);
  });

  test("should reject a wrong password of a different length", () => {
    expect(() =>
      verifyBasicPassword("a-considerably-longer-password", "secret"),
    ).not.toThrow();

    expect(verifyBasicPassword("a-considerably-longer-password", "secret")).toBe(false);
    expect(verifyBasicPassword("s", "secret")).toBe(false);
    expect(verifyBasicPassword("", "secret")).toBe(false);
  });

  test("should reject an unknown credential without throwing", () => {
    expect(() => verifyBasicPassword("secret", undefined)).not.toThrow();

    expect(verifyBasicPassword("secret", undefined)).toBe(false);
    expect(verifyBasicPassword("", undefined)).toBe(false);
  });

  test("should verify passwords with colons, unicode and percent characters", () => {
    expect(verifyBasicPassword("pa:ss:word", "pa:ss:word")).toBe(true);
    expect(verifyBasicPassword("s>cret&more", "s>cret&more")).toBe(true);
    expect(verifyBasicPassword("100%æøå", "100%æøå")).toBe(true);
    expect(verifyBasicPassword("100%æøå", "100%aoa")).toBe(false);
  });

  test("should verify an empty configured password", () => {
    expect(verifyBasicPassword("", "")).toBe(true);
    expect(verifyBasicPassword("x", "")).toBe(false);
  });
});
