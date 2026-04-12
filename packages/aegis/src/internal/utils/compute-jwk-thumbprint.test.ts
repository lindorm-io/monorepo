import {
  TEST_EC_KEY_SIG,
  TEST_OKP_KEY_SIG,
  TEST_RSA_KEY_SIG,
} from "../../__fixtures__/keys";
import { JwtError } from "../../errors";
import { computeJwkThumbprint } from "./compute-jwk-thumbprint";

describe("computeJwkThumbprint", () => {
  test("should compute thumbprint for an EC JWK", () => {
    const jwk = TEST_EC_KEY_SIG.export("jwk");
    const thumbprint = computeJwkThumbprint(jwk);

    expect(thumbprint).toBe(TEST_EC_KEY_SIG.thumbprint);
  });

  test("should compute thumbprint for an RSA JWK", () => {
    const jwk = TEST_RSA_KEY_SIG.export("jwk");
    const thumbprint = computeJwkThumbprint(jwk);

    expect(thumbprint).toBe(TEST_RSA_KEY_SIG.thumbprint);
  });

  test("should compute thumbprint for an OKP JWK", () => {
    const jwk = TEST_OKP_KEY_SIG.export("jwk");
    const thumbprint = computeJwkThumbprint(jwk);

    expect(thumbprint).toBe(TEST_OKP_KEY_SIG.thumbprint);
  });

  test("should compute the same thumbprint regardless of extra fields", () => {
    const jwk = TEST_EC_KEY_SIG.export("jwk");
    const thumbprintWithExtras = computeJwkThumbprint({
      ...jwk,
      alg: "ES512",
      use: "sig",
      kid: "some-id",
    });

    expect(thumbprintWithExtras).toBe(TEST_EC_KEY_SIG.thumbprint);
  });

  test("should throw for unsupported kty", () => {
    expect(() => computeJwkThumbprint({ kty: "unknown" })).toThrow(JwtError);
  });
});
