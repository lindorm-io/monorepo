import { decode, encode } from "cbor2";
import { describe, expect, test } from "vitest";
import { KryptosError } from "../../../errors/index.js";
import type { LindormJwk } from "../../../types/index.js";
import { CBOR_LABEL, CBOR_VERSION } from "../../constants/cbor-table.js";
import { decodeCborEnv } from "./decode-cbor-env.js";
import { encodeCborEnv } from "./encode-cbor-env.js";

// A minimal, valid EC private JWK (public members only need to be present for a
// thumbprint; d makes it private). Values are arbitrary base64url.
const EC_JWK = {
  kty: "EC",
  kid: "key_test0000000000",
  alg: "ES256",
  use: "sig",
  crv: "P-256",
  x: "dnDs6hGAVm7XG06tA-OvjD3M_wmKnUktV0cidWVqST4",
  y: "LJQOuo83vZfAuyfm-UBdNgbPP5fKXRwGgcF8he_rPxw",
  d: "5vqNoQ2p5aQ4o1nJ8bYyq7Q3rN2wZ0xX9cV8bN1mA0",
  exp: 2493100800,
  iat: 1704096000,
  nbf: 1704096000,
  hidden: false,
} as unknown as LindormJwk;

// Re-decode our own output into a raw map so tests can tamper with it.
const baseMap = (): Map<number, unknown> =>
  decode(encodeCborEnv(EC_JWK), { preferMap: true });

describe("decodeCborEnv", () => {
  test("round-trips a JWK through encode + decode", () => {
    const decoded = decodeCborEnv(encodeCborEnv(EC_JWK));

    expect(decoded.kty).toBe("EC");
    expect(decoded.alg).toBe("ES256");
    expect(decoded.crv).toBe("P-256");
    expect(decoded.x).toBe(EC_JWK.x);
    expect(decoded.kid).toBe(EC_JWK.kid);
    expect(decoded.hidden).toBe(false);
  });

  test("rejects an unknown label", () => {
    const map = baseMap();
    map.set(99, "surprise");

    expect(() => decodeCborEnv(encode(map, { cde: true }))).toThrow(KryptosError);
    expect(() => decodeCborEnv(encode(map, { cde: true }))).toThrow(
      /Unknown CBOR label/i,
    );
  });

  test("rejects an unknown enum value", () => {
    const map = baseMap();
    map.set(CBOR_LABEL.alg, 9999);

    expect(() => decodeCborEnv(encode(map, { cde: true }))).toThrow(/Unknown CBOR alg/i);
  });

  test("rejects a future format version", () => {
    const map = baseMap();
    map.set(CBOR_LABEL.version, CBOR_VERSION + 1);

    expect(() => decodeCborEnv(encode(map, { cde: true }))).toThrow(/newer kryptos/i);
  });

  test("rejects a missing version", () => {
    const map = baseMap();
    map.delete(CBOR_LABEL.version);

    expect(() => decodeCborEnv(encode(map, { cde: true }))).toThrow(/version/i);
  });

  test("rejects a non-map payload", () => {
    expect(() => decodeCborEnv(encode([1, 2, 3], { cde: true }))).toThrow(
      /must decode to a map/i,
    );
  });
});
