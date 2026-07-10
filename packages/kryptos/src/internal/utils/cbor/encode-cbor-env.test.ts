import { decode } from "cbor2";
import { describe, expect, test } from "vitest";
import type { LindormJwk } from "../../../types/index.js";
import { CBOR_LABEL } from "../../constants/cbor-table.js";
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
  hidden: false,
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

  test("omits key_ops when it equals the alg/use default", () => {
    const map = asMap(encodeCborEnv(EC_JWK));

    expect(map.has(CBOR_LABEL.key_ops)).toBe(false);
  });

  test("emits key_ops when it differs from the default", () => {
    const map = asMap(encodeCborEnv({ ...EC_JWK, key_ops: ["sign"] }));

    expect(map.get(CBOR_LABEL.key_ops)).toEqual([1]); // [sign]
  });

  test("emits hidden as a boolean and omits absent optional text", () => {
    const map = asMap(encodeCborEnv(EC_JWK));

    expect(map.get(CBOR_LABEL.hidden)).toBe(false);
    expect(map.has(CBOR_LABEL.iss)).toBe(false);
    expect(map.has(CBOR_LABEL.purpose)).toBe(false);
  });
});
