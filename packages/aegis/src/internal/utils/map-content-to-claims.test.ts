import MockDate from "mockdate";
import { mapContentToClaims } from "./map-content-to-claims.js";
import { describe, expect, test } from "vitest";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

describe("mapContentToClaims", () => {
  test("maps the domain vocabulary to wire claims", () => {
    expect(
      mapContentToClaims(
        { algorithm: "ES512" },
        {
          audience: ["resource-1"],
          confirmation: { thumbprint: "jkt-value" },
          expires: "1h",
          scope: ["read"],
          subject: "subject-1",
          tokenType: "test_token",
        },
      ),
    ).toMatchSnapshot();
  });

  test("injects no envelope claims (policy-free)", () => {
    const claims = mapContentToClaims({ algorithm: "ES512" }, {
      subject: "subject-1",
      tokenType: "test_token",
      expires: "1h",
    } as any);

    expect(claims.iat).toBeUndefined();
    expect(claims.jti).toBeUndefined();
    expect(claims.nbf).toBeUndefined();
    expect(claims.iss).toBeUndefined();
    expect(claims.sub).toBe("subject-1");
    expect(claims.exp).toBe(1704099600);
  });

  test("omits exp when content has no expires", () => {
    const claims = mapContentToClaims({ algorithm: "ES512" }, {
      subject: "subject-1",
      tokenType: "test_token",
    } as any);

    expect(claims.exp).toBeUndefined();
  });

  test("honours explicit options.tokenId and options.issuedAt without inventing them", () => {
    const claims = mapContentToClaims(
      { algorithm: "ES512" },
      { subject: "subject-1", tokenType: "test_token" } as any,
      { tokenId: "fixed-jti", issuedAt: new Date("2024-01-01T08:00:00.000Z") },
    );

    expect(claims.jti).toBe("fixed-jti");
    expect(claims.iat).toBe(1704096000);
  });
});
