import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import type { DomainTokenHeader } from "../header/domain-header.js";
import type { TokenProfile } from "../profile/profile.js";
import type { DecryptedToken } from "./decrypted-token.js";
import type { NarrowedClaims, NarrowedToken, VerifiedToken } from "./verified-token.js";

// A complete DomainTokenHeader (the full-breadth domain header). Building the
// whole shape is the compile-check: every domain header field is accounted for.
const header: DomainTokenHeader = {
  algorithm: "ES256",
  baseFormat: "JWT",
  certificateChain: undefined,
  certificateThumbprint: undefined,
  certificateThumbprintSha1: undefined,
  certificateUrl: undefined,
  contentType: "application/json",
  critical: [],
  encryption: undefined,
  headerType: "at+jwt",
  initialisationVector: undefined,
  jwk: undefined,
  jwksUri: undefined,
  keyId: "key_abc",
  objectId: undefined,
  partyProducer: undefined,
  partyRecipient: undefined,
  pbkdfIterations: undefined,
  pbkdfSalt: undefined,
  publicEncryptionJwk: undefined,
  publicEncryptionTag: undefined,
  tokenType: "access_token",
  zip: undefined,
};

describe("VerifiedToken (type witness — not yet returned by verify, Phase 19)", () => {
  test("a jwt result carries domain claims + custom bucket", () => {
    const verified: VerifiedToken = {
      format: "jwt",
      header,
      claims: { subject: "user_1", issuer: "https://idp.lindorm.io/" },
      custom: { acmeFlag: true },
      token: "eyJ.body.sig",
    };

    expect(verified.format).toBe("jwt");
    expect(verified.claims.subject).toBe("user_1");
    expect(verified.custom.acmeFlag).toBe(true);
  });

  test("a jws result delivers raw beside empty domain buckets", () => {
    const verified: VerifiedToken = {
      format: "jws",
      header,
      claims: {},
      custom: {},
      raw: "opaque payload",
      token: "eyJ.body.sig",
    };

    expect(verified.raw).toBe("opaque payload");
  });

  // `raw` is the payload AS THE TYPE IT WAS SIGNED AS, and an OBJECT signed
  // under `application/json` comes back a Dict on BOTH wires — always on `cws`,
  // and on `jws` since the domain sign stopped JSON-stringifying first. The type
  // was `Buffer | string`, which excluded the one shape the codec most commonly
  // reconstructs, so a consumer holding an object payload had to cast to reach
  // it. `Assert<false>` is the compile error if the union ever narrows back.
  test("a Dict payload is expressible as raw", () => {
    type Assert<T extends true> = T;
    type _RawAdmitsADict = Assert<
      Dict extends NonNullable<VerifiedToken["raw"]> ? true : false
    >;

    const verified: VerifiedToken = {
      format: "jws",
      header,
      claims: {},
      custom: {},
      raw: { hello: "world" },
      token: "eyJ.body.sig",
    };

    // The literal above is the other half of the same statement: assigning an
    // object to `raw` is itself the compile check, and it did not compile under
    // the old union.
    expect(verified.raw).toEqual({ hello: "world" });
  });
});

describe("DecryptedToken (type witness)", () => {
  test("an encrypted-outer result, confidential but not authenticated", () => {
    const decrypted: DecryptedToken = {
      format: "jwe",
      inner: "jwt",
      // ⚠ Still ONE header, unlike the verify/parse results above: the decrypt
      // result's COSE header merges the unprotected bucket in, and splitting it
      // is a change with nothing behind it yet.
      header,
      // ⚠ ONE payload cell, and NO claim buckets at all — the literal is the
      // compile check. `encrypt`/`decrypt` are a pure confidentiality pair, so
      // there is no vocabulary here to sort a value into; `claims`/`custom` would
      // not compile.
      payload: { subject: "user_1" },
      token: "eyJ.a.b.c.d",
    };

    expect(decrypted.format).toBe("jwe");
    expect(decrypted.inner).toBe("jwt");
  });

  test("the payload admits every shape the codec reconstructs", () => {
    const base = { format: "cwe", header, token: "0oRD" } as const;

    // Each literal is its own compile check: a Dict, a string, a Buffer and the
    // structured values a JSON/CBOR plaintext can be. Narrowing the field to
    // `Buffer | string` would fail on the first and the last two.
    expect(
      (
        [
          { ...base, payload: { hello: "world" } },
          { ...base, payload: "an opaque string" },
          { ...base, payload: Buffer.from([0xca, 0xfe]) },
          { ...base, payload: [1, 2, 3] },
          { ...base, payload: 42 },
          { ...base, payload: true },
        ] satisfies ReadonlyArray<DecryptedToken>
      ).length,
    ).toBe(6);
  });

  test("the generic names the OBJECT shape a caller sealed", () => {
    type Session = { sessionId: string };

    const decrypted: DecryptedToken<Session> = {
      format: "jwe",
      header,
      payload: { sessionId: "s-1" },
      token: "eyJ.a.b.c.d",
    };

    // The narrowing is the point: without the generic in the object slot the
    // caller would have to cast the result to read its own shape back.
    expect(
      isString(decrypted.payload) ? undefined : (decrypted.payload as Session).sessionId,
    ).toBe("s-1");
  });
});

describe("NarrowedToken (type witness)", () => {
  test("the profile's required claims are non-optional on .claims", () => {
    type MiniProfile = TokenProfile<
      readonly [
        {
          rule: "required";
          on: readonly ["mint", "verify"];
          claims: readonly ["subject", "issuer"];
        },
      ]
    >;

    const narrowed: NarrowedToken<MiniProfile> = {
      format: "jwt",
      header,
      claims: { subject: "user_1", issuer: "https://idp.lindorm.io/" },
      custom: {},
      token: "eyJ.body.sig",
    };

    // Compile-check: the narrowed claims are `string`, not `string | undefined`.
    const subject: string = narrowed.claims.subject;
    const issuer: string = narrowed.claims.issuer;

    expect(subject).toBe("user_1");
    expect(issuer).toBe("https://idp.lindorm.io/");
  });

  // The other half of the same mechanism, and the half a positive witness cannot
  // show: a requirement declared for MINT ALONE says nothing about the token that
  // ARRIVED, so narrowing off it would put a guarantee in the type that no
  // runtime check makes. `Assert<false>` is the compile error if it ever does.
  test("a mint-only requirement does NOT narrow the verified claims", () => {
    type MintOnlyProfile = TokenProfile<
      readonly [{ rule: "required"; on: readonly ["mint"]; claims: readonly ["subject"] }]
    >;

    type Assert<T extends true> = T;
    type _SubjectStaysOptional = Assert<
      undefined extends NarrowedClaims<MintOnlyProfile>["subject"] ? true : false
    >;

    const narrowed: NarrowedToken<MintOnlyProfile> = {
      format: "jwt",
      header,
      claims: {},
      custom: {},
      token: "eyJ.body.sig",
    };

    expect(narrowed.claims.subject).toBeUndefined();
  });
});
