import { describe, expect, test } from "vitest";
import type { WireTokenHeader } from "../../types/index.js";
import { HEADER_SPECS, headerJoseName } from "./header-registry.js";
import { isProtectedOnly } from "./is-protected-only.js";
import { mergeHeaderBuckets } from "./merge-header-buckets.js";

const protectedHeader = (header: Partial<WireTokenHeader>): WireTokenHeader =>
  header as WireTokenHeader;

describe("the placement allowlist", () => {
  /**
   * THE LIST, spelled out. ⛔ Not derived from `placement` — that is the column
   * the production code reads, so deriving it would make this test agree with any
   * value the registry happens to hold. These two names are the ORACLE: `kid` is
   * the routing hint RFC 9052 §3.1 permits outside the protected bucket, `iv` the
   * AEAD nonce a COSE_Encrypt0 carries there (RFC 9052 §5.2), and nothing else
   * may ever arrive unauthenticated. Widening the list is a security decision and
   * has to be made HERE, deliberately, not by editing one registry row.
   */
  test("exactly kid and iv may travel unauthenticated", () => {
    const placeable = HEADER_SPECS.filter(
      (spec) => !isProtectedOnly(headerJoseName(spec)),
    ).map(headerJoseName);

    expect(placeable.sort()).toEqual(["iv", "kid"]);
  });

  // Headers are a CLOSED set, and an unregistered name has no placement to
  // consult. The write side hands it to `coseByJose`, which refuses it by name;
  // the read side drops it in `parseTokenHeader`. Answering `true` here would
  // replace both accurate answers with a placement error about a parameter that
  // has none.
  test("an unregistered parameter is not protected-only", () => {
    expect(isProtectedOnly("not-a-header-parameter")).toBe(false);
  });
});

describe("mergeHeaderBuckets", () => {
  test("admits an allowlisted parameter from the unprotected bucket", () => {
    const merged = mergeHeaderBuckets({
      protectedHeader: protectedHeader({ alg: "ES512" }),
      unprotectedHeader: { kid: "key-1" },
    });

    expect(merged).toEqual({ alg: "ES512", kid: "key-1" });
  });

  // The rule the domain tier's single header rests on: a parameter a verifier
  // routes, audits or polices a token by cannot arrive from a bucket nothing
  // covers. Every one of these is `placement: "protected"`.
  test("IGNORES every parameter that must be signed", () => {
    const merged = mergeHeaderBuckets({
      protectedHeader: protectedHeader({ alg: "ES512" }),
      unprotectedHeader: {
        typ: "application/at+cwt",
        cty: "application/json",
        oid: "1.2.3.4",
        x5u: "https://attacker.lindorm.test/certs.pem",
        x5c: ["MIIBforged"],
      },
    });

    expect(merged).toEqual({ alg: "ES512" });
  });

  test("the PROTECTED value wins where both buckets state one", () => {
    const merged = mergeHeaderBuckets({
      protectedHeader: protectedHeader({ alg: "ES512", kid: "signed" }),
      unprotectedHeader: { kid: "presented" },
    });

    expect(merged.kid).toBe("signed");
  });

  // An explicitly `undefined` value is an ABSENT parameter, not a value. Copying
  // one would let the protected bucket clobber a legitimate unprotected `kid`
  // with nothing — the exact hazard a whole-object spread carries.
  test("an undefined protected value does not clobber an unprotected one", () => {
    const merged = mergeHeaderBuckets({
      protectedHeader: protectedHeader({ alg: "ES512", kid: undefined }),
      unprotectedHeader: { kid: "key-1" },
    });

    expect(merged.kid).toBe("key-1");
  });

  test("an empty unprotected bucket leaves the protected header untouched", () => {
    const merged = mergeHeaderBuckets({
      protectedHeader: protectedHeader({ alg: "ES512", typ: "JWT" }),
      unprotectedHeader: {},
    });

    expect(merged).toEqual({ alg: "ES512", typ: "JWT" });
  });
});
