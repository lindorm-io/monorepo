import { describe, expect, test } from "vitest";
import type { IKryptos } from "../interfaces/index.js";
import { KryptosKit } from "./index.js";

const NOT_BEFORE = new Date("2026-01-01T00:00:00Z");

const ec = () => KryptosKit.generate.auto({ algorithm: "ES256" });
const okp = () => KryptosKit.generate.auto({ algorithm: "EdDSA" });
const rsa = () => KryptosKit.generate.auto({ algorithm: "RS256" });
const oct = () => KryptosKit.generate.auto({ algorithm: "A256KW" });
const akp = () => KryptosKit.generate.auto({ algorithm: "ML-DSA-44" });

const rootCa = () =>
  KryptosKit.generate.auto({
    algorithm: "ES384",
    notBefore: NOT_BEFORE,
    expiresAt: new Date("2046-01-01T00:00:00Z"),
    certificate: { mode: "root-ca", subject: "Root", organization: "Lindorm" },
  });

const caSigned = () =>
  KryptosKit.generate.auto({
    algorithm: "ES256",
    notBefore: NOT_BEFORE,
    expiresAt: new Date("2036-01-01T00:00:00Z"),
    certificate: {
      mode: "ca-signed",
      ca: rootCa(),
      subject: "leaf",
      organization: "Lindorm",
    },
  });

const CASES: Array<[string, () => IKryptos]> = [
  ["EC", ec],
  ["OKP", okp],
  ["RSA (CRT)", rsa],
  ["oct", oct],
  ["AKP", akp],
  [
    "EC self-cert",
    () =>
      KryptosKit.generate.auto({
        algorithm: "ES256",
        certificate: { mode: "self-signed", subject: "self" },
      }),
  ],
  ["EC ca-signed 2-chain", caSigned],
];

describe("Kryptos env-string format", () => {
  describe.each(CASES)("round-trip: %s", (_name, make) => {
    test("cbor (default) reproduces id, attributes and material", () => {
      const key = make();

      const restored = KryptosKit.env.import(KryptosKit.env.export(key));

      expect(restored.id).toBe(key.id);
      expect(restored.toJWK("private")).toEqual(key.toJWK("private"));
    });

    test("json (opt-in) reproduces id, attributes and material", () => {
      const key = make();

      const restored = KryptosKit.env.import(KryptosKit.env.export(key, "json"));

      expect(restored.id).toBe(key.id);
      expect(restored.toJWK("private")).toEqual(key.toJWK("private"));
    });

    test("cbor and json forms import to equal keys (same id)", () => {
      const key = make();

      const fromCbor = KryptosKit.env.import(key.toEnvString("cbor"));
      const fromJson = KryptosKit.env.import(key.toEnvString("json"));

      expect(fromCbor.id).toBe(fromJson.id);
      expect(fromCbor.toJWK("private")).toEqual(fromJson.toJWK("private"));
    });
  });

  describe("auto-detect", () => {
    test("imports a JSON env string (0x7b first byte)", () => {
      const key = ec();
      const json = key.toEnvString("json");

      expect(KryptosKit.env.import(json).id).toBe(key.id);
    });

    test("imports a CBOR env string (map header first byte)", () => {
      const key = ec();
      const cbor = key.toEnvString("cbor");

      expect(KryptosKit.env.import(cbor).id).toBe(key.id);
    });

    test("rejects a payload that is neither JSON nor a CBOR map", () => {
      const garbage = "kryptos:" + Buffer.from([0x01, 0x02, 0x03]).toString("base64url");

      expect(() => KryptosKit.env.import(garbage)).toThrow(/env payload|kryptos/i);
    });
  });

  test("cbor is more compact than json (reported, not a magnitude assertion)", () => {
    const sizes = CASES.map(([name, make]) => {
      const key = make();
      return {
        name,
        cbor: key.toEnvString("cbor").length,
        json: key.toEnvString("json").length,
      };
    });

    for (const { cbor, json } of sizes) {
      expect(cbor).toBeLessThan(json);
    }
  });
});
