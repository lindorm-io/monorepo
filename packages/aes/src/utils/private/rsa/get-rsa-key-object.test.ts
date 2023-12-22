import { PRIVATE_RSA_PEM, PUBLIC_RSA_PEM } from "../../../fixtures/rsa-keys.fixture";
import { getRsaKeyObject } from "./get-rsa-key-object";

describe("getRsaKeyObject", () => {
  test("should resolve key object with oaep hash for private key", () => {
    expect(getRsaKeyObject(PRIVATE_RSA_PEM)).toStrictEqual({ key: PRIVATE_RSA_PEM.privateKey });
  });

  test("should resolve key object with oaep hash for public key", () => {
    expect(getRsaKeyObject(PUBLIC_RSA_PEM)).toStrictEqual({ key: PUBLIC_RSA_PEM.publicKey });
  });

  test("should resolve key object with passphrase", () => {
    expect(getRsaKeyObject({ ...PRIVATE_RSA_PEM, passphrase: "passphrase" })).toStrictEqual({
      key: PRIVATE_RSA_PEM.privateKey,
      passphrase: "passphrase",
    });
  });
});
