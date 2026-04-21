import { encodeNull, encodeOid, encodeSequence } from "../asn1/index.js";
import { X509_OID_ECDSA_WITH_SHA256, X509_OID_SHA256_WITH_RSA } from "./oids.js";
import { parseX509AlgorithmIdentifier } from "./parse-algorithm-identifier.js";
import { describe, expect, test } from "vitest";

describe("parseX509AlgorithmIdentifier", () => {
  test("round-trips ECDSA-SHA256 (no params)", () => {
    const der = encodeSequence([encodeOid(X509_OID_ECDSA_WITH_SHA256)]);
    expect(parseX509AlgorithmIdentifier(der)).toBe(X509_OID_ECDSA_WITH_SHA256);
  });

  test("round-trips RSA-SHA256 (with NULL params)", () => {
    const der = encodeSequence([encodeOid(X509_OID_SHA256_WITH_RSA), encodeNull()]);
    expect(parseX509AlgorithmIdentifier(der)).toBe(X509_OID_SHA256_WITH_RSA);
  });

  test("throws when not a SEQUENCE", () => {
    expect(() =>
      parseX509AlgorithmIdentifier(encodeOid(X509_OID_SHA256_WITH_RSA)),
    ).toThrow(/not a SEQUENCE/);
  });
});
