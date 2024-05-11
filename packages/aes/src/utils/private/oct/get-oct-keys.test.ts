import { OCT_KEY_SET } from "../../../__fixtures__/oct-keys.fixture";
import { _getOctDecryptionKey, _getOctEncryptionKeys } from "./get-oct-keys";

describe("get-oct-keys", () => {
  test("should return oct encryption keys from PEM", () => {
    expect(_getOctEncryptionKeys({ encryption: "aes-256-gcm", kryptos: OCT_KEY_SET })).toEqual({
      encryptionKey: Buffer.from("EllJuW/YiIYyk2i6Yyr+HBcfRLxwHkg/hVDUKTKT5kA=", "base64"),
    });
  });

  test("should return oct encryption keys from JWK", () => {
    expect(_getOctEncryptionKeys({ encryption: "aes-256-gcm", kryptos: OCT_KEY_SET })).toEqual({
      encryptionKey: Buffer.from("EllJuW/YiIYyk2i6Yyr+HBcfRLxwHkg/hVDUKTKT5kA=", "base64"),
    });
  });

  test("should return oct decryption key from PEM", () => {
    expect(_getOctDecryptionKey({ encryption: "aes-256-gcm", kryptos: OCT_KEY_SET })).toEqual(
      Buffer.from("EllJuW/YiIYyk2i6Yyr+HBcfRLxwHkg/hVDUKTKT5kA=", "base64"),
    );
  });

  test("should return oct decryption key from JWK", () => {
    expect(_getOctDecryptionKey({ encryption: "aes-256-gcm", kryptos: OCT_KEY_SET })).toEqual(
      Buffer.from("EllJuW/YiIYyk2i6Yyr+HBcfRLxwHkg/hVDUKTKT5kA=", "base64"),
    );
  });
});
