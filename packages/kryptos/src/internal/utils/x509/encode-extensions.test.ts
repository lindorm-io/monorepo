import { generateKeyPairSync } from "crypto";
import {
  authorityKeyIdentifierExt,
  basicConstraintsExt,
  computeSubjectKeyIdentifier,
  keyUsageExt,
  subjectAlternativeNameExt,
  subjectKeyIdentifierExt,
  wrapExtension,
} from "./encode-extensions";

describe("encode-extensions", () => {
  test("basicConstraintsExt with CA=false omits BOOLEAN", () => {
    expect(basicConstraintsExt(false).toString("hex")).toMatchSnapshot();
  });

  test("basicConstraintsExt with CA=true includes BOOLEAN TRUE", () => {
    expect(basicConstraintsExt(true).toString("hex")).toMatchSnapshot();
  });

  test("keyUsageExt digitalSignature only", () => {
    expect(keyUsageExt({ digitalSignature: true }).toString("hex")).toMatchSnapshot();
  });

  test("keyUsageExt keyEncipherment + dataEncipherment", () => {
    expect(
      keyUsageExt({ keyEncipherment: true, dataEncipherment: true }).toString("hex"),
    ).toMatchSnapshot();
  });

  test("keyUsageExt keyCertSign + crlSign", () => {
    expect(
      keyUsageExt({ keyCertSign: true, crlSign: true }).toString("hex"),
    ).toMatchSnapshot();
  });

  test("keyUsageExt throws when empty", () => {
    expect(() => keyUsageExt({})).toThrow("keyUsage extension requires at least one bit");
  });

  test("subjectKeyIdentifierExt computes SHA-1 of the SPKI BIT STRING body", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    const spki = publicKey.export({ format: "der", type: "spki" }) as Buffer;
    const ski = computeSubjectKeyIdentifier(spki);
    expect(ski.length).toBe(20);
    const ext = subjectKeyIdentifierExt(spki);
    expect(ext.includes(ski)).toBe(true);
  });

  test("authorityKeyIdentifierExt wraps OCTET STRING in [0] IMPLICIT", () => {
    const fake = Buffer.alloc(20, 0xab);
    expect(authorityKeyIdentifierExt(fake).toString("hex")).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt encodes URI entries as [6] IMPLICIT", () => {
    expect(
      subjectAlternativeNameExt([
        "https://example.test/a",
        "https://example.test/b",
      ]).toString("hex"),
    ).toMatchSnapshot();
  });

  test("wrapExtension omits BOOLEAN when critical=false", () => {
    expect(
      wrapExtension("1.2.3.4", Buffer.from([0x05, 0x00]), false).toString("hex"),
    ).toMatchSnapshot();
  });

  test("wrapExtension includes BOOLEAN TRUE when critical=true", () => {
    expect(
      wrapExtension("1.2.3.4", Buffer.from([0x05, 0x00]), true).toString("hex"),
    ).toMatchSnapshot();
  });
});
