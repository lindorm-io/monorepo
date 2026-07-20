import { describe, expect, test } from "vitest";
import { extractSensitiveClaims } from "./extract-sensitive-claims.js";

describe("extractSensitiveClaims", () => {
  test("partitions the sensitive-category domain claims off the rest", () => {
    const { sensitive, rest } = extractSensitiveClaims({
      issuer: "https://test.lindorm.io/",
      subject: "user-1",
      nationalIdentityNumber: "19900101-1234",
      nationalIdentityNumberVerified: true,
      socialSecurityNumber: "078-05-1120",
      socialSecurityNumberVerified: false,
    });

    expect(sensitive).toEqual({
      nationalIdentityNumber: "19900101-1234",
      nationalIdentityNumberVerified: true,
      socialSecurityNumber: "078-05-1120",
      socialSecurityNumberVerified: false,
    });
    expect(rest).toEqual({ issuer: "https://test.lindorm.io/", subject: "user-1" });
    expect(rest).not.toHaveProperty("nationalIdentityNumber");
  });

  test("returns undefined sensitive when none are present, rest is a copy", () => {
    const input = { issuer: "iss", subject: "user-1" };
    const { sensitive, rest } = extractSensitiveClaims(input);

    expect(sensitive).toBeUndefined();
    expect(rest).toEqual(input);
    expect(rest).not.toBe(input); // a fresh copy, not the same reference
  });

  test("collects only the sensitive fields that are actually present", () => {
    const { sensitive, rest } = extractSensitiveClaims({
      subject: "user-1",
      socialSecurityNumber: "078-05-1120",
    });

    expect(sensitive).toEqual({ socialSecurityNumber: "078-05-1120" });
    expect(rest).toEqual({ subject: "user-1" });
  });
});
