import { describe, expect, test } from "vitest";
import type { TokenProfile } from "./jwt/profile.js";
import type {
  DecryptedToken,
  NarrowedToken,
  VerifiedToken,
  VerifiedTokenHeader,
} from "./verified-token.js";

// A complete VerifiedTokenHeader (= the full-breadth domain header). Building the
// whole shape is the compile-check: every domain header field is accounted for.
const header: VerifiedTokenHeader = {
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
});

describe("DecryptedToken (type witness)", () => {
  test("an encrypted-outer result, confidential but not authenticated", () => {
    const decrypted: DecryptedToken = {
      format: "jwe",
      inner: "jwt",
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
    type MiniProfile = TokenProfile<readonly ["subject", "issuer"]>;

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
});
