import { describe, expect, test } from "vitest";
import { canonicalWireHeader } from "./canonical-wire-header.js";

describe("canonicalWireHeader", () => {
  test("orders the keys alphabetically by JOSE name", () => {
    expect(
      Object.keys(canonicalWireHeader({ zip: "DEF", alg: "ES512", kid: "key_test" })),
    ).toEqual(["alg", "kid", "zip"]);
  });

  test("the certificate family orders x5c, x5t, x5t#S256, x5u", () => {
    // The one boundary a hand-written order gets wrong: `#` (U+0023) sorts before
    // every letter, but a shorter string still sorts before its own prefix
    // extension — so `x5t` precedes `x5t#S256`, which precedes `x5u`. The signed
    // bytes are this order, so it is pinned rather than assumed.
    expect(
      Object.keys(
        canonicalWireHeader({
          x5u: "https://a.test/certs",
          "x5t#S256": "sha256",
          x5t: "sha1",
          x5c: ["leaf"],
        }),
      ),
    ).toEqual(["x5c", "x5t", "x5t#S256", "x5u"]);
  });

  test("keeps every value, and an already-ordered header unchanged", () => {
    const header = { alg: "ES512", kid: "key_test", typ: "JWT" };

    expect(canonicalWireHeader(header)).toEqual(header);
  });
});
