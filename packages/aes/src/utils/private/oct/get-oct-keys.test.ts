import { OCT_KEY_SET } from "../../../fixtures/oct-keys.fixture";
import { getOctDecryptionKey, getOctEncryptionKeys } from "./get-oct-keys";

describe("get-oct-keys", () => {
  test("should return oct encryption keys from PEM", () => {
    expect(getOctEncryptionKeys({ encryption: "aes-256-gcm", keySet: OCT_KEY_SET })).toStrictEqual({
      encryptionKey: Buffer.from("NzQkG@LScmpy@LGMiOK@MBxbtuRN@BEa"),
    });
  });

  test("should return oct encryption keys from JWK", () => {
    expect(getOctEncryptionKeys({ encryption: "aes-256-gcm", keySet: OCT_KEY_SET })).toStrictEqual({
      encryptionKey: Buffer.from("NzQkG@LScmpy@LGMiOK@MBxbtuRN@BEa"),
    });
  });

  test("should return oct decryption key from PEM", () => {
    expect(getOctDecryptionKey({ encryption: "aes-256-gcm", keySet: OCT_KEY_SET })).toStrictEqual(
      Buffer.from("NzQkG@LScmpy@LGMiOK@MBxbtuRN@BEa"),
    );
  });

  test("should return oct decryption key from JWK", () => {
    expect(getOctDecryptionKey({ encryption: "aes-256-gcm", keySet: OCT_KEY_SET })).toStrictEqual(
      Buffer.from("NzQkG@LScmpy@LGMiOK@MBxbtuRN@BEa"),
    );
  });
});
