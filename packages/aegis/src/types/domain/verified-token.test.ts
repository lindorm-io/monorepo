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
      protectedHeader: header,
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
      protectedHeader: header,
      claims: {},
      custom: {},
      raw: "opaque payload",
      token: "eyJ.body.sig",
    };

    expect(verified.raw).toBe("opaque payload");
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
      claims: { subject: "user_1" },
      custom: {},
      token: "eyJ.a.b.c.d",
    };

    expect(decrypted.format).toBe("jwe");
    expect(decrypted.inner).toBe("jwt");
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
      protectedHeader: header,
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
      protectedHeader: header,
      claims: {},
      custom: {},
      token: "eyJ.body.sig",
    };

    expect(narrowed.claims.subject).toBeUndefined();
  });
});
