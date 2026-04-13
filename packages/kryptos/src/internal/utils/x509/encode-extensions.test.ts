import { generateKeyPairSync } from "crypto";
import { KryptosError } from "../../../errors";
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
  test("basicConstraintsExt ca=false", () => {
    expect(basicConstraintsExt({ ca: false }).toString("hex")).toMatchSnapshot();
  });

  test("basicConstraintsExt ca=true", () => {
    expect(basicConstraintsExt({ ca: true }).toString("hex")).toMatchSnapshot();
  });

  test("basicConstraintsExt ca=true with pathLengthConstraint=0", () => {
    expect(
      basicConstraintsExt({ ca: true, pathLengthConstraint: 0 }).toString("hex"),
    ).toMatchSnapshot();
  });

  test("basicConstraintsExt ca=true with pathLengthConstraint=3", () => {
    expect(
      basicConstraintsExt({ ca: true, pathLengthConstraint: 3 }).toString("hex"),
    ).toMatchSnapshot();
  });

  test("basicConstraintsExt throws when ca=false and pathLengthConstraint provided", () => {
    expect(() => basicConstraintsExt({ ca: false, pathLengthConstraint: 1 })).toThrow(
      KryptosError,
    );
  });

  test("basicConstraintsExt throws when pathLengthConstraint is negative", () => {
    expect(() => basicConstraintsExt({ ca: true, pathLengthConstraint: -1 })).toThrow(
      KryptosError,
    );
  });

  test("keyUsageExt digitalSignature only", () => {
    expect(keyUsageExt(["digitalSignature"]).toString("hex")).toMatchSnapshot();
  });

  test("keyUsageExt keyEncipherment + dataEncipherment", () => {
    expect(
      keyUsageExt(["keyEncipherment", "dataEncipherment"]).toString("hex"),
    ).toMatchSnapshot();
  });

  test("keyUsageExt keyCertSign + cRLSign", () => {
    expect(keyUsageExt(["keyCertSign", "cRLSign"]).toString("hex")).toMatchSnapshot();
  });

  test("keyUsageExt throws when empty", () => {
    expect(() => keyUsageExt([])).toThrow("keyUsage extension requires at least one bit");
  });

  test("keyUsageExt throws on unknown flag", () => {
    expect(() => keyUsageExt(["bogus" as unknown as "digitalSignature"])).toThrow(
      KryptosError,
    );
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
