import { describe, expect, test } from "vitest";
import { KryptosError } from "../../errors/index.js";
import type { KryptosJwk } from "../../types/index.js";
import { computeKeyId } from "./compute-key-id.js";

const EC_JWK = {
  kty: "EC",
  crv: "P-256",
  x: "dnDs6hGAVm7XG06tA-OvjD3M_wmKnUktV0cidWVqST4",
  y: "LJQOuo83vZfAuyfm-UBdNgbPP5fKXRwGgcF8he_rPxw",
  alg: "ES256",
  use: "sig",
  kid: "ignored-kid",
} as unknown as KryptosJwk;

describe("computeKeyId", () => {
  test("derives a stable `key_` id from an EC jwk (RFC 7638 thumbprint)", () => {
    expect(computeKeyId(EC_JWK)).toMatchSnapshot();
  });

  test("ignores kid and private members — only public members feed the thumbprint", () => {
    const withPrivateAndOtherKid = {
      ...EC_JWK,
      kid: "some-other-kid",
      d: "cbdd4e2f0e3d4a7b9d1e0f5c6a8b2d4f6081a3c5e7091b2d4f60718293a4b5c6d",
    } as unknown as KryptosJwk;

    expect(computeKeyId(withPrivateAndOtherKid)).toBe(computeKeyId(EC_JWK));
  });

  test("different public material derives a different id", () => {
    const other = {
      ...EC_JWK,
      x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    } as unknown as KryptosJwk;

    expect(computeKeyId(other)).not.toBe(computeKeyId(EC_JWK));
  });

  test("rejects oct — its canonical form hashes the secret", () => {
    expect(() =>
      computeKeyId({ kty: "oct", k: "c2VjcmV0" } as unknown as KryptosJwk),
    ).toThrow(KryptosError);
  });

  test("rejects an unsupported kty", () => {
    expect(() => computeKeyId({ kty: "XYZ" } as unknown as KryptosJwk)).toThrow(
      KryptosError,
    );
  });
});
