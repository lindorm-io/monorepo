import { TEST_OCT_KEY } from "../../../__fixtures__/keys";
import { _getOctDecryptionKey, _getOctEncryptionKeys } from "./get-oct-keys";

describe("get-oct-keys", () => {
  test("should return oct encryption keys from PEM", () => {
    expect(_getOctEncryptionKeys({ encryption: "aes-256-gcm", kryptos: TEST_OCT_KEY })).toEqual({
      encryptionKey: Buffer.from("Wd4vrP6WApdbbOG0pbiFf9fWKZMGJ6mbgKzNZAt4Pw4=", "base64"),
    });
  });

  test("should return oct encryption keys from JWK", () => {
    expect(_getOctEncryptionKeys({ encryption: "aes-256-gcm", kryptos: TEST_OCT_KEY })).toEqual({
      encryptionKey: Buffer.from("Wd4vrP6WApdbbOG0pbiFf9fWKZMGJ6mbgKzNZAt4Pw4=", "base64"),
    });
  });

  test("should return oct decryption key from PEM", () => {
    expect(_getOctDecryptionKey({ encryption: "aes-256-gcm", kryptos: TEST_OCT_KEY })).toEqual(
      Buffer.from("Wd4vrP6WApdbbOG0pbiFf9fWKZMGJ6mbgKzNZAt4Pw4=", "base64"),
    );
  });

  test("should return oct decryption key from JWK", () => {
    expect(_getOctDecryptionKey({ encryption: "aes-256-gcm", kryptos: TEST_OCT_KEY })).toEqual(
      Buffer.from("Wd4vrP6WApdbbOG0pbiFf9fWKZMGJ6mbgKzNZAt4Pw4=", "base64"),
    );
  });
});
