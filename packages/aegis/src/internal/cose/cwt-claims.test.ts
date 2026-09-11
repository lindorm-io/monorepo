import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { AegisError } from "../../errors/index.js";
import { CLAIM_SPECS, coseName } from "../claims/claims-registry.js";
import { codecFor } from "../registry/param-spec.js";
import { domainToWire, wireToDomain } from "../claims/translate.js";
import { decodeCbor, encodeCbor } from "./cbor.js";
import { decodeCwtClaims, type EncodeCwtOptions, encodeCwtClaims } from "./cwt-claims.js";

const AT_HASH = "LXEWQrcmsEQBYnyp-6wy9chTD7GQPMTbAiWHF5IaSIE"; // 32-byte b64url

// `encodeCwtClaims`/`decodeCwtClaims` are the CODEC boundary — wire in, wire out.
// These helpers drive the full domain round trip the codec sits inside.
const encode = (common: Dict, options?: EncodeCwtOptions) =>
  encodeCwtClaims(domainToWire(common, coseName), options);

const decodeToDomain = (map: Map<unknown, unknown> | Dict): Dict => {
  const { claims, custom } = wireToDomain(decodeCwtClaims(map), coseName, "token");
  return { ...claims, ...custom };
};

describe("encodeCwtClaims", () => {
  test("maps domain claims to CWT integer labels / string keys (proprietary)", () => {
    // On-platform: compact private-use integer labels.
    const map = encode(
      {
        issuer: "https://issuer/",
        subject: "u1",
        audience: ["https://rs/"],
        expiresAt: new Date(1700003600 * 1000),
        issuedAt: new Date(1700000000 * 1000),
        tokenId: "the-jti",
        scope: ["read", "write"],
        clientId: "client-1", // no CWT label but ≥ 5 chars -> private-use integer
        levelOfAssurance: 3, // no CWT label, ≤ 4 chars -> string key
      },
      { proprietary: true },
    );

    expect(map.get(1)).toBe("https://issuer/"); // iss
    expect(map.get(2)).toBe("u1"); // sub
    expect(map.get(3)).toEqual(["https://rs/"]); // aud
    expect(map.get(4)).toBe(1700003600); // exp (Date -> unix int)
    expect(map.get(6)).toBe(1700000000); // iat
    expect(Buffer.from(map.get(7) as Uint8Array).toString("utf8")).toBe("the-jti"); // cti bstr
    expect(map.get(9)).toBe("read write"); // scope — one text string (RFC 9200 §8.14)
    expect(map.get(-65537 - 11)).toBe("client-1"); // client_id private-use label
    expect(map.has("client_id")).toBe(false); // not string-keyed on-platform
    expect(map.get("loa")).toBe(3); // loa string-keyed (≤ 4 chars)
  });

  test("encodes OIDC hash claims as byte strings", () => {
    // ⚠ Every hash claim, not just `at_hash`: each is a SEPARATE registry cell
    // declaring the same `per: { cose: { kind: "bstr", encoding: "b64u" } }`
    // override, and a typo in one is a SILENT wrong-bytes bug — the claim still
    // encodes, as a CBOR text string or as the raw characters rather than the
    // bytes they stand for.
    const map = encode(
      { accessTokenHash: AT_HASH, codeHash: AT_HASH, stateHash: AT_HASH },
      { proprietary: true },
    );

    for (const [claim, label] of [
      ["at_hash", -65537 - 0],
      ["c_hash", -65537 - 1],
      ["s_hash", -65537 - 2],
    ] as const) {
      const bytes = map.get(label) as Uint8Array;
      expect(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array, claim).toBe(true);
      expect(Buffer.from(bytes).length, claim).toBe(32);
      expect(Buffer.from(bytes).toString("base64url"), claim).toBe(AT_HASH);
    }
  });

  test("keeps custom passthrough claims under their literal key", () => {
    const map = encode({ token_introspection: { active: true } });
    expect(map.get("token_introspection")).toEqual({ active: true });
  });

  test("defers structured claims (cnf) with a clear error", () => {
    expect(() => encode({ confirmation: { thumbprint: "x" } })).toThrow(AegisError);
  });
});

describe("proprietary encoding", () => {
  const act = { subject: "actor", issuer: "https://delegator/", clientId: "c-2" };

  test("act is compact integer-keyed under proprietary:true", () => {
    const map = encode({ act }, { proprietary: true });
    const encodedAct = map.get("act") as Map<number, unknown>;
    expect(encodedAct).toBeInstanceOf(Map);
    expect(encodedAct.get(1)).toBe("https://delegator/"); // issuer reuses CWT iss
    expect(encodedAct.get(2)).toBe("actor"); // subject reuses CWT sub
    expect(encodedAct.get(4)).toBe("c-2"); // clientId — lindorm label
  });

  test("act is interoperable string-keyed by default (proprietary:false)", () => {
    const map = encode({ act }); // default is interoperable
    // The interoperable object carries RFC 8693 wire member names — the shape
    // `internal/claims/translate.ts` produces for both wires.
    expect(map.get("act")).toEqual({
      sub: "actor",
      iss: "https://delegator/",
      client_id: "c-2",
    });
  });

  test("private-use claims degrade to their JOSE string key off-platform (never dropped)", () => {
    const withTenant = { issuer: "https://i/", tenantId: "t-1" };
    // On-platform: compact private-use integer label.
    const on = encode(withTenant, { proprietary: true });
    expect(on.get(-65537 - 14)).toBe("t-1"); // tenant_id private label
    expect(on.has("tenant_id")).toBe(false);
    // Interoperable: degraded to the JOSE string key, NOT dropped.
    const off = encode(withTenant);
    expect(off.has(-65537 - 14)).toBe(false);
    expect(off.get("tenant_id")).toBe("t-1");
    expect(off.get(1)).toBe("https://i/"); // iss kept
  });

  test("standards-based assurance levels (loa/aal/ial/fal) are string-keyed on both platforms", () => {
    const claims = {
      levelOfAssurance: 4,
      authenticatorAssuranceLevel: 2,
      identityAssuranceLevel: 3,
      federationAssuranceLevel: 1,
    };

    for (const proprietary of [true, false]) {
      const map = encode(claims, { proprietary });
      expect(map.has(-65537)).toBe(false);
      expect(map.get("loa")).toBe(4);
      expect(map.get("aal")).toBe(2);
      expect(map.get("ial")).toBe(3);
      expect(map.get("fal")).toBe(1);
    }
  });

  test("sub_id is compact integer-keyed under a private-use label by default, JOSE string-keyed object when proprietary:false", () => {
    const subjectId = { format: "iss_sub", issuer: "https://i/", subject: "u" };

    // On-platform: keyed by the private-use label, value the compact map.
    const map = encode({ subjectId }, { proprietary: true });
    const compact = map.get(-65537 - 12) as Map<number, unknown>;
    expect(map.has("sub_id")).toBe(false);
    expect(compact).toBeInstanceOf(Map);
    expect(compact.get(0)).toBe("iss_sub"); // format
    expect(compact.get(1)).toBe("https://i/"); // iss reuses CWT label 1
    expect(compact.get(2)).toBe("u"); // sub reuses CWT label 2

    // Off-platform: keyed by the JOSE string name, value the plain object.
    const off = encode({ subjectId }, { proprietary: false });
    expect(off.has(-65537 - 12)).toBe(false);
    expect(off.get("sub_id")).toEqual({ format: "iss_sub", iss: "https://i/", sub: "u" });
  });

  test("compact act round-trips through CBOR", () => {
    const claims = { issuer: "https://i/", act }; // issuer (label 1) keeps the top a Map
    const bytes = encodeCbor(encode(claims, { proprietary: true }));
    const decoded = decodeToDomain(
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

    const bytes = encodeCbor(encode(common));
    const decoded = decodeToDomain(decodeCbor<Map<unknown, unknown>>(bytes));

    expect(decoded).toEqual(common);
  });

  // A token mixing claims that take private-use integer labels on-platform with
  // short string-keyed ones.
  const reclassified = {
    issuer: "https://issuer/",
    subject: "u1",
    nonce: "n-123",
    authTime: new Date(1700000000 * 1000),
    clientId: "client-1",
    entitlements: ["e1", "e2"],
    roles: ["admin"],
    groups: ["g1"],
    permissions: ["read", "write"],
    tenantId: "tenant-7",
    levelOfAssurance: 3, // short -> string-keyed
    authContextClassReference: "urn:acr:high", // acr, short -> string-keyed
  };

  test("reclassified claims round-trip on-platform (integer labels)", () => {
    const map = encode(reclassified, { proprietary: true });
    // On-platform: long claims integer-keyed, short claims string-keyed.
    expect(map.get(-65537 - 3)).toBe("n-123"); // nonce
    expect(map.get(-65537 - 11)).toBe("client-1"); // client_id
    expect(map.get(-65537 - 14)).toBe("tenant-7"); // tenant_id
    expect(map.get("loa")).toBe(3); // string-keyed
    expect(map.get("acr")).toBe("urn:acr:high"); // string-keyed

    const decoded = decodeToDomain(decodeCbor<Map<unknown, unknown>>(encodeCbor(map)));
    expect(decoded).toEqual(reclassified);
  });

  test("reclassified claims round-trip off-platform (JOSE string keys, never dropped)", () => {
    const map = encode(reclassified, { proprietary: false });
    // Off-platform: the long claims degrade to their JOSE string keys.
    expect(map.has(-65537 - 3)).toBe(false);
    expect(map.get("nonce")).toBe("n-123");
    expect(map.get("client_id")).toBe("client-1");
    expect(map.get("tenant_id")).toBe("tenant-7");
    expect(map.get("loa")).toBe(3); // unchanged
    expect(map.get("acr")).toBe("urn:acr:high"); // unchanged

    const decoded = decodeToDomain(
      decodeCbor<Map<unknown, unknown>>(encodeCbor(map), { preferMap: false }),
    );
    expect(decoded).toEqual(reclassified);
  });
});

/**
 * The CODEC's OWN emptiness rule, which the aegis claim registry does not govern.
 *
 * `whenEmpty` is read in ONE place — `internal/utils/normalise-claims.ts`, above
 * both wires — and neither this file's codec nor `cwt-spec.ts` consults it. The
 * COSE side then applies a second, unconditional rule of its own at
 * `packages/cbor/src/internal/utils/encode-cbor-map.ts`, so a claim the registry
 * says to KEEP when empty is kept on JOSE and dropped here.
 *
 * ⚠ Which is not live, and the second test is what keeps it that way: no claim is
 * `text` on COSE and `whenEmpty: "keep"`, so the registry's column does govern
 * both wires today. That test reddens on the flip that would make it stop.
 */
describe("the codec's own empty-value rule", () => {
  test("an empty TEXT claim is dropped and an empty ARRAY claim survives", () => {
    // Both halves, so the row cannot pass by everything dropping. `iss` is text
    // (label 1); `aud` is an array (label 3). RFC 8392 §3.1.
    expect([...encodeCwtClaims({ iss: "" }).entries()]).toEqual([]);
    expect([...encodeCwtClaims({ aud: [] }).entries()]).toEqual([[3, []]]);
  });

  test("no claim is text on COSE and kept when empty, so the registry governs both wires", () => {
    const ungoverned = CLAIM_SPECS.filter(
      (spec) => spec.whenEmpty === "keep" && codecFor(spec, "cose").kind === "text",
    ).map((spec) => spec.domain);

    expect(CLAIM_SPECS.length).toBeGreaterThan(0);
    expect(ungoverned).toEqual([]);
  });
});
