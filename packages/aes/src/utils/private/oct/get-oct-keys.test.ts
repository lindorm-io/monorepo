import { TEST_OCT_KEY } from "../../../__fixtures__/keys";
import { _getOctDecryptionKey, _getOctEncryptionKeys } from "./get-oct-keys";

describe("get-oct-keys", () => {
  test("should return oct encryption keys from PEM", () => {
    expect(
      _getOctEncryptionKeys({ encryption: "aes-256-gcm", kryptos: TEST_OCT_KEY }),
    ).toEqual({
      encryptionKey: Buffer.from(
        "dEqUfs8Liq2t7OWaBA9Y7g/ljk7sEm4CvBajqQYNAZk=",
        "base64",
      ),
    });
  });

  test("should return oct encryption keys from JWK", () => {
    expect(
      _getOctEncryptionKeys({ encryption: "aes-256-gcm", kryptos: TEST_OCT_KEY }),
    ).toEqual({
      encryptionKey: Buffer.from(
        "dEqUfs8Liq2t7OWaBA9Y7g/ljk7sEm4CvBajqQYNAZk=",
        "base64",
      ),
    });
  });

  test("should return oct decryption key from PEM", () => {
    expect(
      _getOctDecryptionKey({ encryption: "aes-256-gcm", kryptos: TEST_OCT_KEY }),
    ).toEqual(Buffer.from("dEqUfs8Liq2t7OWaBA9Y7g/ljk7sEm4CvBajqQYNAZk=", "base64"));
  });

  test("should return oct decryption key from JWK", () => {
    expect(
      _getOctDecryptionKey({ encryption: "aes-256-gcm", kryptos: TEST_OCT_KEY }),
    ).toEqual(Buffer.from("dEqUfs8Liq2t7OWaBA9Y7g/ljk7sEm4CvBajqQYNAZk=", "base64"));
  });
});
