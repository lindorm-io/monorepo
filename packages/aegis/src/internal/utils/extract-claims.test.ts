import { describe, expect, test } from "vitest";
import { extractDomainClaims } from "./extract-claims.js";

const ISSUER = "https://test.lindorm.io/";

describe("extractDomainClaims", () => {
  test("maps the wire sub_id to the domain subjectId (RFC 9493)", () => {
    const { claims, rest } = extractDomainClaims({
      iss: ISSUER,
      sub_id: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
    });

    expect(claims).toMatchObject({
      issuer: ISSUER,
      subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
    });
    expect(rest).toEqual({});
  });

  test("accepts the camelCase domain form", () => {
    const { claims, rest } = extractDomainClaims({
      subjectId: { format: "opaque", id: "abc" },
    });

    expect(claims).toMatchObject({ subjectId: { format: "opaque", id: "abc" } });
    expect(rest).toEqual({});
  });

  test("drops a non-object sub_id", () => {
    const { claims } = extractDomainClaims({ sub_id: "not-an-object" });

    expect(claims.subjectId).toBeUndefined();
  });
});
