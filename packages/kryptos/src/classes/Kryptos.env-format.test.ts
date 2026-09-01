import { B64 } from "@lindorm/b64";
import { describe, expect, test } from "vitest";
import type { IKryptos } from "../interfaces/index.js";
import { decodeCborEnv } from "../internal/utils/cbor/decode-cbor-env.js";
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

  // The two env formats do NOT carry the same members for a key with a chain.
  // JSON is the private JWK verbatim, so it carries whatever `toJWK` emits —
  // including both digests. CBOR carries only what `CBOR_ENV_SPEC.fields`
  // declares (`internal/constants/cbor-env-spec.ts`) — a field is what reaches
  // the wire, and there is none for either digest. Both re-derive from `x5c`.
  describe("certificate members per env format", () => {
    const decodeJson = (env: string): Record<string, unknown> =>
      JSON.parse(B64.toString(env.replace("kryptos:", ""), "b64u"));

    test("json carries x5c and BOTH digests for a chained key", () => {
      const key = caSigned();
      const payload = decodeJson(key.toEnvString("json"));
      const certificate = key.certificate("jwk")!;

      expect(payload.x5c).toEqual(certificate.x5c);
      expect(payload.x5t).toBe(certificate.x5t);
      expect(payload["x5t#S256"]).toBe(certificate["x5t#S256"]);
    });

    test("json carries no certificate members for a chain-less key", () => {
      const payload = decodeJson(ec().toEnvString("json"));

      expect(payload.x5c).toBeUndefined();
      expect(payload.x5t).toBeUndefined();
      expect(payload["x5t#S256"]).toBeUndefined();
    });

    test("cbor carries x5c and NEITHER digest for a chained key", () => {
      const key = caSigned();
      const decoded = decodeCborEnv(
        B64.toBuffer(key.toEnvString("cbor").replace("kryptos:", ""), "b64u"),
      ) as Record<string, unknown>;

      expect(decoded.x5c).toEqual(key.certificate("b64")!.chain);
      expect(decoded.x5t).toBeUndefined();
      expect(decoded["x5t#S256"]).toBeUndefined();
    });

    test("both formats restore both digests on import", () => {
      const key = caSigned();
      const expected = key.certificate("b64")!;

      for (const format of ["json", "cbor"] as const) {
        const restored = KryptosKit.env.import(key.toEnvString(format));

        expect(restored.certificate("b64")!.thumbprint).toBe(expected.thumbprint);
        expect(restored.certificate("b64")!.thumbprintSha1).toBe(expected.thumbprintSha1);
      }
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
