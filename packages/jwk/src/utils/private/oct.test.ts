import { createHmac } from "crypto";
import { createOctJwk, createOctPem } from "./oct";

const sign = (symmetricKey: string, input: string) =>
  createHmac("sha256", symmetricKey).update(input).digest("base64url");

const verify = (symmetricKey: string, input: string, signature: string) =>
  sign(symmetricKey, input) === signature;

describe("oct", () => {
  const id = "id";
  const kid = id;

  const type = "oct";
  const kty = type;

  const symmetricKey = "12345678901234567890123456789012";

  const k = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=";

  test("should encode the symmetric key", () => {
    expect(createOctJwk({ id, symmetricKey, type })).toStrictEqual({
      k,
      kid,
      kty,
    });
  });

  test("should decode the symmetric key", () => {
    expect(createOctPem({ k, kid, kty })).toStrictEqual({
      id,
      symmetricKey,
      type,
    });
  });

  test("should resolve a valid symmetric key", () => {
    const { symmetricKey: decodedSymmetricKey } = createOctPem({ k, kid, kty });
    const signature = sign(decodedSymmetricKey, "input");

    expect(verify(decodedSymmetricKey, "input", signature)).toBe(true);
  });
});
