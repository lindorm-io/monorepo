import { TEST_EC_KEY, TEST_OKP_KEY } from "../../../__fixtures__/keys";
import { calculateSharedSecret, generateSharedSecret } from "./shared-secret";

describe("sharedSecret", () => {
  test("should generate and calculate shared secret with EC", () => {
    const kryptos = TEST_EC_KEY;

    const result = generateSharedSecret(kryptos);

    expect(result).toEqual({
      publicEncryptionJwk: {
        crv: "P-521",
        kty: "EC",
        x: expect.any(String),
        y: expect.any(String),
      },
      sharedSecret: expect.any(Buffer),
    });

    expect(
      calculateSharedSecret({
        kryptos,
        publicEncryptionJwk: result.publicEncryptionJwk,
      }),
    ).toEqual(result.sharedSecret);
  });

  test("should generate and calculate shared secret with OKP", () => {
    const kryptos = TEST_OKP_KEY;

    const result = generateSharedSecret(kryptos);

    expect(result).toEqual({
      publicEncryptionJwk: {
        crv: "X25519",
        kty: "OKP",
        x: expect.any(String),
      },
      sharedSecret: expect.any(Buffer),
    });

    expect(
      calculateSharedSecret({
        kryptos,
        publicEncryptionJwk: result.publicEncryptionJwk,
      }),
    ).toEqual(result.sharedSecret);
  });
});
