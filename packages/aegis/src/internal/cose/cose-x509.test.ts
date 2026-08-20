import { B64 } from "@lindorm/b64";
import { describe, expect, test } from "vitest";
import { decodeCoseX509, encodeCoseX509 } from "./cose-x509.js";

const LEAF = Buffer.from([0x30, 0x82, 0x01, 0x0a]);
const INTERMEDIATE = Buffer.from([0x30, 0x82, 0x02, 0x0b]);

const LEAF_B64 = B64.encode(LEAF);
const INTERMEDIATE_B64 = B64.encode(INTERMEDIATE);

/**
 * RFC 9360 §2 `COSE_X509 = bstr / [ 2*certs: bstr ]`, and §2's prose fixes which
 * arm applies, in two adjacent bullets: *"If a single certificate is conveyed, it
 * is placed in a CBOR byte string. […] If multiple certificates are conveyed, a
 * CBOR array of byte strings is used, with each certificate being in its own byte
 * string."*
 */
describe("encodeCoseX509", () => {
  test("a single certificate becomes the bare byte string", () => {
    expect(encodeCoseX509([LEAF_B64])).toEqual(LEAF);
  });

  // `2*certs` requires TWO, so a one-member array is not a conformant COSE_X509
  // and the single-cert arm is not an optimisation.
  test("a chain becomes an array of byte strings, leaf first", () => {
    expect(encodeCoseX509([LEAF_B64, INTERMEDIATE_B64])).toEqual([LEAF, INTERMEDIATE]);
  });

  test.each([
    ["a non-array", "MIIBsample"],
    ["an array holding a non-string", [LEAF_B64, 42]],
    ["an empty chain", []],
  ])("leaves %s untouched — neither arm admits it", (_what, value) => {
    expect(encodeCoseX509(value)).toBe(value);
  });
});

describe("decodeCoseX509", () => {
  // RFC 7515 §4.1.6 makes a JOSE `x5c` entry STANDARD base64 of the DER, not
  // base64url, so the two encodings are not interchangeable here.
  test("a bare byte string becomes a one-member base64 array", () => {
    expect(decodeCoseX509(LEAF)).toEqual([LEAF_B64]);
  });

  test("an array of byte strings becomes base64, order preserved", () => {
    expect(decodeCoseX509([LEAF, INTERMEDIATE])).toEqual([LEAF_B64, INTERMEDIATE_B64]);
  });

  test.each([
    ["a text value", "MIIBsample"],
    ["an array holding a non-bstr", [LEAF, "MIIBsample"]],
  ])("leaves %s untouched", (_what, value) => {
    expect(decodeCoseX509(value)).toBe(value);
  });
});

describe("round trip", () => {
  test.each([
    ["one certificate", [LEAF_B64]],
    ["a chain", [LEAF_B64, INTERMEDIATE_B64]],
  ])("%s survives encode then decode", (_what, chain) => {
    expect(decodeCoseX509(encodeCoseX509(chain))).toEqual(chain);
  });
});
