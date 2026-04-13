import { encodeBoolean, encodeOctetString, encodeOid, encodeSequence } from "../asn1";
import {
  authorityKeyIdentifierExt,
  basicConstraintsExt,
  keyUsageExt,
  subjectAlternativeNameExt,
  subjectKeyIdentifierExt,
  wrapExtension,
} from "./encode-extensions";
import { parseX509Extensions } from "./parse-extensions";
import { spkiFromPublicKey } from "./spki-from-public-key";
import { generateKeyPairSync } from "crypto";

const buildSpki = (): Buffer => {
  const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const der = publicKey.export({ format: "der", type: "spki" }) as Buffer;
  return spkiFromPublicKey(der, "EC");
};

describe("parseX509Extensions", () => {
  test("parses a typical extensions block", () => {
    const spki = buildSpki();
    const der = encodeSequence([
      basicConstraintsExt(true),
      keyUsageExt({ digitalSignature: true, keyCertSign: true, crlSign: true }),
      subjectKeyIdentifierExt(spki),
      authorityKeyIdentifierExt(Buffer.alloc(20, 0xab)),
      subjectAlternativeNameExt(["https://example.com/"]),
    ]);

    const parsed = parseX509Extensions(der);
    expect(parsed.basicConstraintsCa).toBe(true);
    expect(parsed.keyUsage).toEqual(["digitalSignature", "keyCertSign", "crlSign"]);
    expect(parsed.subjectKeyIdentifier).toBeInstanceOf(Buffer);
    expect(parsed.subjectKeyIdentifier?.length).toBe(20);
    expect(parsed.authorityKeyIdentifier?.equals(Buffer.alloc(20, 0xab))).toBe(true);
    expect(parsed.subjectAltNames).toEqual([
      { type: "uri", value: "https://example.com/" },
    ]);
  });

  test("basicConstraints defaults to ca=false when CA boolean is absent", () => {
    const der = encodeSequence([wrapExtension("2.5.29.19", encodeSequence([]), true)]);
    const parsed = parseX509Extensions(der);
    expect(parsed.basicConstraintsCa).toBe(false);
  });

  test("throws on unknown critical extension", () => {
    const unknownOid = "1.2.3.4.5.6.7.8";
    const der = encodeSequence([
      encodeSequence([
        encodeOid(unknownOid),
        encodeBoolean(true),
        encodeOctetString(Buffer.from([0x00])),
      ]),
    ]);
    expect(() => parseX509Extensions(der)).toThrow(/Unknown critical/);
  });

  test("silently ignores unknown non-critical extension", () => {
    const unknownOid = "1.2.3.4.5.6.7.8";
    const der = encodeSequence([
      encodeSequence([encodeOid(unknownOid), encodeOctetString(Buffer.from([0x00]))]),
      basicConstraintsExt(false),
    ]);
    const parsed = parseX509Extensions(der);
    expect(parsed.basicConstraintsCa).toBe(false);
  });
});
