import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import { coseName, joseName } from "../claims/claims-registry.js";
import { buildSignedToken } from "./build-signed-token.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

describe("buildSignedToken (domain sugar over a wire kit's bare token)", () => {
  const token = "header.payload.signature";

  test("derives the expiry bundle from the wire exp and the tokenId from jti", () => {
    expect(
      buildSignedToken(
        token,
        { exp: 1704099600, jti: "jti-1" },
        "obj-1",
        "jwt",
        joseName,
      ),
    ).toEqual({
      expiresAt: new Date("2024-01-01T09:00:00.000Z"),
      expiresIn: 3600,
      expiresOn: 1704099600,
      format: "jwt",
      objectId: "obj-1",
      token,
      tokenId: "jti-1",
    });
  });

  test("leaves the expiry bundle and tokenId undefined when exp/jti are absent", () => {
    expect(buildSignedToken(token, { sub: "s" }, undefined, "jws", joseName)).toEqual({
      expiresAt: undefined,
      expiresIn: undefined,
      expiresOn: undefined,
      format: "jws",
      objectId: undefined,
      token,
      tokenId: undefined,
    });
  });

  // The whole reason this is ONE function: the COSE selector reads the token id
  // from `cti`, and nothing else about either wire differs.
  test("the COSE selector reads the token id from cti, not jti", () => {
    expect(
      buildSignedToken(
        token,
        { exp: 1704099600, cti: "cti-1" },
        undefined,
        "cwt",
        coseName,
      ),
    ).toMatchObject({ expiresOn: 1704099600, tokenId: "cti-1" });
  });

  test("the COSE selector IGNORES a jti, and the JOSE selector ignores a cti", () => {
    expect(
      buildSignedToken(token, { jti: "jti-1" }, undefined, "cwt", coseName).tokenId,
    ).toBeUndefined();
    expect(
      buildSignedToken(token, { cti: "cti-1" }, undefined, "jwt", joseName).tokenId,
    ).toBeUndefined();
  });

  test("`exp` is spelled the same on both wires, so both selectors read it", () => {
    for (const nameOf of [joseName, coseName]) {
      expect(
        buildSignedToken(token, { exp: 1704099600 }, undefined, "cwt", nameOf).expiresOn,
      ).toBe(1704099600);
    }
  });

  test("a non-numeric exp and a non-string token id are ignored", () => {
    expect(
      buildSignedToken(token, { exp: "1704099600", jti: 42 }, undefined, "jwt", joseName),
    ).toMatchObject({ expiresAt: undefined, expiresOn: undefined, tokenId: undefined });
  });

  test("a non-finite exp (NaN/Infinity) is ignored", () => {
    for (const exp of [NaN, Infinity, -Infinity]) {
      expect(
        buildSignedToken(token, { exp }, undefined, "jwt", joseName).expiresOn,
      ).toBeUndefined();
    }
  });
});
