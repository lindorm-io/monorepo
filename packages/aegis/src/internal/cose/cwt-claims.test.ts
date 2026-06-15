import { describe, expect, test } from "vitest";
import { AegisError } from "../../errors/index.js";
import { decodeCbor, encodeCbor } from "./cbor.js";
import { decodeCwtClaims, encodeCwtClaims } from "./cwt-claims.js";

const AT_HASH = "LXEWQrcmsEQBYnyp-6wy9chTD7GQPMTbAiWHF5IaSIE"; // 32-byte b64url

describe("encodeCwtClaims", () => {
  test("maps domain claims to CWT integer labels / string keys", () => {
    const map = encodeCwtClaims({
      issuer: "https://issuer/",
      subject: "u1",
      audience: ["https://rs/"],
      expiresAt: new Date(1700003600 * 1000),
      issuedAt: new Date(1700000000 * 1000),
      tokenId: "the-jti",
      scope: ["read", "write"],
      clientId: "client-1", // no CWT int label -> string key
      levelOfAssurance: 3, // proprietary -> private-use label
    });

    expect(map.get(1)).toBe("https://issuer/"); // iss
    expect(map.get(2)).toBe("u1"); // sub
    expect(map.get(3)).toEqual(["https://rs/"]); // aud
    expect(map.get(4)).toBe(1700003600); // exp (Date -> unix int)
    expect(map.get(6)).toBe(1700000000); // iat
    expect(Buffer.from(map.get(7) as Uint8Array).toString("utf8")).toBe("the-jti"); // cti bstr
    expect(map.get(9)).toEqual(["read", "write"]); // scope
    expect(map.get("client_id")).toBe("client-1"); // string-keyed
    expect(map.get(-65537)).toBe(3); // loa private-use label
  });

  test("encodes OIDC hash claims as byte strings", () => {
    const map = encodeCwtClaims({ accessTokenHash: AT_HASH });
    const bytes = map.get("at_hash") as Uint8Array;
    expect(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array).toBe(true);
    expect(Buffer.from(bytes).length).toBe(32);
  });

  test("keeps custom passthrough claims under their literal key", () => {
    const map = encodeCwtClaims({ token_introspection: { active: true } });
    expect(map.get("token_introspection")).toEqual({ active: true });
  });

  test("defers structured claims (cnf) with a clear error", () => {
    expect(() => encodeCwtClaims({ confirmation: { thumbprint: "x" } })).toThrow(
      AegisError,
    );
  });
});

describe("proprietary encoding", () => {
  const act = { subject: "actor", issuer: "https://delegator/", clientId: "c-2" };

  test("act is compact integer-keyed by default (proprietary)", () => {
    const map = encodeCwtClaims({ act });
    const encodedAct = map.get("act") as Map<number, unknown>;
    expect(encodedAct).toBeInstanceOf(Map);
    expect(encodedAct.get(1)).toBe("https://delegator/"); // issuer reuses CWT iss
    expect(encodedAct.get(2)).toBe("actor"); // subject reuses CWT sub
    expect(encodedAct.get(4)).toBe("c-2"); // clientId — lindorm label
  });

  test("act is interoperable string-keyed when proprietary:false", () => {
    const map = encodeCwtClaims({ act }, { proprietary: false });
    expect(map.get("act")).toEqual(act); // the plain object
  });

  test("proprietary-labelled claims are dropped when proprietary:false", () => {
    const withLoa = { issuer: "https://i/", levelOfAssurance: 3 };
    expect(encodeCwtClaims(withLoa).get(-65537)).toBe(3); // loa private label (default)
    expect(encodeCwtClaims(withLoa, { proprietary: false }).has(-65537)).toBe(false);
    expect(encodeCwtClaims(withLoa, { proprietary: false }).get(1)).toBe("https://i/"); // iss kept
  });

  test("sub_id is compact integer-keyed by default, string-keyed when proprietary:false", () => {
    const subjectId = { format: "iss_sub", iss: "https://i/", sub: "u" };

    const compact = encodeCwtClaims({ subjectId }).get("sub_id") as Map<number, unknown>;
    expect(compact).toBeInstanceOf(Map);
    expect(compact.get(0)).toBe("iss_sub"); // format
    expect(compact.get(1)).toBe("https://i/"); // iss reuses CWT label 1
    expect(compact.get(2)).toBe("u"); // sub reuses CWT label 2

    expect(encodeCwtClaims({ subjectId }, { proprietary: false }).get("sub_id")).toEqual(
      subjectId,
    );
  });

  test("compact act round-trips through CBOR", () => {
    const claims = { issuer: "https://i/", act }; // issuer (label 1) keeps the top a Map
    const bytes = encodeCbor(encodeCwtClaims(claims));
    const decoded = decodeCwtClaims(
      decodeCbor<Map<unknown, unknown>>(bytes, { preferMap: false }),
    );
    expect(decoded).toEqual(claims);
  });
});

describe("CWT claims round-trip (domain -> CBOR -> domain)", () => {
  test("standard envelope + flat claims survive a full encode/decode", () => {
    const common = {
      issuer: "https://issuer/",
      subject: "u1",
      audience: ["https://rs/"],
      expiresAt: new Date(1700003600 * 1000),
      issuedAt: new Date(1700000000 * 1000),
      tokenId: "the-jti",
      scope: ["read", "write"],
      clientId: "client-1",
      accessTokenHash: AT_HASH,
      levelOfAssurance: 3,
    };

    const bytes = encodeCbor(encodeCwtClaims(common));
    const decoded = decodeCwtClaims(decodeCbor<Map<unknown, unknown>>(bytes));

    expect(decoded).toEqual(common);
  });
});
