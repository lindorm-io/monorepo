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
import { describe, expect, test } from "vitest";

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

  test("basicConstraintsExt throws when pathLengthConstraint is 256", () => {
    expect(() => basicConstraintsExt({ ca: true, pathLengthConstraint: 256 })).toThrow(
      KryptosError,
    );
  });

  test("basicConstraintsExt throws when pathLengthConstraint is 300", () => {
    expect(() => basicConstraintsExt({ ca: true, pathLengthConstraint: 300 })).toThrow(
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
        { type: "uri", value: "https://example.test/a" },
        { type: "uri", value: "https://example.test/b" },
      ]).toString("hex"),
    ).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt encodes DNS entries as [2] IMPLICIT", () => {
    expect(
      subjectAlternativeNameExt([{ type: "dns", value: "example.test" }]).toString("hex"),
    ).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt encodes Email entries as [1] IMPLICIT", () => {
    expect(
      subjectAlternativeNameExt([{ type: "email", value: "ops@example.test" }]).toString(
        "hex",
      ),
    ).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt encodes IPv4 as [7] IMPLICIT with 4 raw bytes", () => {
    expect(
      subjectAlternativeNameExt([{ type: "ip", value: "192.168.1.1" }]).toString("hex"),
    ).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt encodes IPv6 ::1 as 16 raw bytes", () => {
    expect(
      subjectAlternativeNameExt([{ type: "ip", value: "::1" }]).toString("hex"),
    ).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt encodes IPv6 2001:db8::1", () => {
    expect(
      subjectAlternativeNameExt([{ type: "ip", value: "2001:db8::1" }]).toString("hex"),
    ).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt encodes IPv6 fe80::1", () => {
    expect(
      subjectAlternativeNameExt([{ type: "ip", value: "fe80::1" }]).toString("hex"),
    ).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt encodes IPv4-mapped IPv6 ::ffff:192.168.1.1", () => {
    expect(
      subjectAlternativeNameExt([{ type: "ip", value: "::ffff:192.168.1.1" }]).toString(
        "hex",
      ),
    ).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt encodes full IPv6 2001:db8:85a3::8a2e:370:7334", () => {
    expect(
      subjectAlternativeNameExt([
        { type: "ip", value: "2001:db8:85a3::8a2e:370:7334" },
      ]).toString("hex"),
    ).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt encodes mixed list", () => {
    expect(
      subjectAlternativeNameExt([
        { type: "uri", value: "https://example.test" },
        { type: "dns", value: "example.test" },
        { type: "email", value: "ops@example.test" },
        { type: "ip", value: "10.0.0.1" },
      ]).toString("hex"),
    ).toMatchSnapshot();
  });

  test("subjectAlternativeNameExt throws on non-ASCII URI", () => {
    expect(() =>
      subjectAlternativeNameExt([{ type: "uri", value: "https://exämple.test" }]),
    ).toThrow("must be ASCII (IA5String)");
  });

  test("subjectAlternativeNameExt throws on non-ASCII DNS", () => {
    expect(() =>
      subjectAlternativeNameExt([{ type: "dns", value: "exämple.test" }]),
    ).toThrow("must be ASCII (IA5String)");
  });

  test("subjectAlternativeNameExt throws on non-ASCII email", () => {
    expect(() =>
      subjectAlternativeNameExt([{ type: "email", value: "øps@example.test" }]),
    ).toThrow("must be ASCII (IA5String)");
  });

  test("subjectAlternativeNameExt throws on invalid IP", () => {
    expect(() => subjectAlternativeNameExt([{ type: "ip", value: "not-an-ip" }])).toThrow(
      "is not a valid IPv4 or IPv6 address",
    );
  });

  test("subjectAlternativeNameExt throws when empty", () => {
    expect(() => subjectAlternativeNameExt([])).toThrow(
      "subjectAlternativeNameExt requires at least one SAN",
    );
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
