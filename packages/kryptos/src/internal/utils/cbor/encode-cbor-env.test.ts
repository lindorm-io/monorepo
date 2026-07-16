import { decode, encode } from "cbor2";
import { describe, expect, test } from "vitest";
import { KryptosKit } from "../../../classes/index.js";
import type { LindormJwk } from "../../../types/index.js";
import { CBOR_LABEL } from "../../constants/cbor-table.js";
import { decodeCborEnv } from "./decode-cbor-env.js";
import { encodeCborEnv } from "./encode-cbor-env.js";

const EC_JWK = {
  kty: "EC",
  kid: "key_test0000000000",
  alg: "ES256",
  use: "sig",
  crv: "P-256",
  x: "dnDs6hGAVm7XG06tA-OvjD3M_wmKnUktV0cidWVqST4",
  y: "LJQOuo83vZfAuyfm-UBdNgbPP5fKXRwGgcF8he_rPxw",
  d: "5vqNoQ2p5aQ4o1nJ8bYyq7Q3rN2wZ0xX9cV8bN1mA0",
  key_ops: ["sign", "verify"],
  exp: 2493100800,
  iat: 1704096000,
  nbf: 1704096000,
  publish: false,
} as unknown as LindormJwk;

const asMap = (bytes: Uint8Array): Map<number, unknown> =>
  decode(bytes, { preferMap: true });

describe("encodeCborEnv", () => {
  test("produces deterministic bytes (snapshot)", () => {
    expect(Buffer.from(encodeCborEnv(EC_JWK)).toString("hex")).toMatchSnapshot();
  });

  test("uses integer labels and enum values", () => {
    const map = asMap(encodeCborEnv(EC_JWK));

    expect(map.get(CBOR_LABEL.version)).toBe(1);
    expect(map.get(CBOR_LABEL.kty)).toBe(1); // EC
    expect(map.get(CBOR_LABEL.alg)).toBe(10); // ES256
    expect(map.get(CBOR_LABEL.use)).toBe(1); // sig
    expect(map.get(CBOR_LABEL.crv)).toBe(1); // P-256
  });

  test("encodes key material as raw byte strings", () => {
    const map = asMap(encodeCborEnv(EC_JWK));

    expect(map.get(CBOR_LABEL.x)).toBeInstanceOf(Uint8Array);
    expect(map.get(CBOR_LABEL.d)).toBeInstanceOf(Uint8Array);
  });

  // `operations` is derived from the key material, so key_ops has nothing to
  // carry — it is never encoded, whatever the JWK claims. `key_ops` has no
  // label at all, hence the bare 7 (the integer it used to occupy).
  const RETIRED_KEY_OPS_LABEL = 7;

  test.each([
    ["the alg/use default", ["sign", "verify"]],
    ["a contradictory list", ["verify"]],
    ["nothing at all", undefined],
  ])("never encodes key_ops (%s)", (_name, keyOps) => {
    const map = asMap(
      encodeCborEnv({ ...EC_JWK, key_ops: keyOps } as unknown as LindormJwk),
    );

    expect(map.has(RETIRED_KEY_OPS_LABEL)).toBe(false);
  });

  // `key_ops` is gone from the vocabulary entirely, so a string carrying its old
  // label is not "legacy but tolerated" — it is an unknown label. The shared codec
  // runs in strict mode and rejects unknown labels loudly; kryptos re-raises that as
  // a KryptosError with the codec's reason preserved in `details`. The env format is
  // pre-release, so there is nothing in the wild to keep compatible.
  test("rejects an env string carrying the retired key_ops label", () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });

    const stale = encode(
      new Map<number, unknown>([
        ...asMap(encodeCborEnv(key.toJWK("private"))),
        [RETIRED_KEY_OPS_LABEL, [1]],
      ]),
      { cde: true },
    );

    expect(() => decodeCborEnv(stale)).toThrowError(
      expect.objectContaining({
        code: "invalid_cbor_env",
        details: expect.stringMatching(/unknown cbor label/i),
      }),
    );
  });

  // The reason key_ops can go: the key material answers the question by itself.
  test("re-derives operations from the key material on import", () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });
    const jwk = decodeCborEnv(encode(asMap(encodeCborEnv(key.toJWK("private")))));

    expect(jwk.key_ops).toBeUndefined();
    expect(KryptosKit.from.jwk(jwk).operations).toEqual(["sign", "verify"]);
  });

  // An explicit `false` must survive: it is what keeps an internal key (KEK, CA,
  // cookie) out of the JWKS, and it is the one value a "strip the empties" pass
  // is most likely to drop.
  test("emits publish as a boolean and omits absent optional text", () => {
    const map = asMap(encodeCborEnv(EC_JWK));

    expect(map.get(CBOR_LABEL.publish)).toBe(false);
    expect(map.has(CBOR_LABEL.iss)).toBe(false);
    expect(map.has(CBOR_LABEL.purpose)).toBe(false);
  });

  test("emits publish:true explicitly rather than relying on the import default", () => {
    const map = asMap(encodeCborEnv({ ...EC_JWK, publish: true }));

    expect(map.get(CBOR_LABEL.publish)).toBe(true);
  });
});
