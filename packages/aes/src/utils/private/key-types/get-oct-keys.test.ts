import { Kryptos } from "@lindorm/kryptos";
import { TEST_OCT_KEY } from "../../../__fixtures__/keys";
import { _getOctDecryptionKey, _getOctEncryptionKey } from "./get-oct-keys";

describe("get-oct-keys", () => {
  test("should return oct encryption key with dir", () => {
    const kryptos = TEST_OCT_KEY;

    const result = _getOctEncryptionKey({ encryption: "aes-256-gcm", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      salt: expect.any(Buffer),
    });

    expect(
      _getOctDecryptionKey({
        encryption: "aes-256-gcm",
        kryptos,
        salt: result.salt,
      }),
    ).toEqual(result.contentEncryptionKey);
  });

  test("should return oct encryption key with key wrap", () => {
    const kryptos = Kryptos.generate({
      algorithm: "A128KW",
      type: "oct",
      use: "enc",
    });

    const result = _getOctEncryptionKey({ encryption: "aes-128-gcm", kryptos });

    expect(result).toEqual({
      contentEncryptionKey: expect.any(Buffer),
      publicEncryptionKey: expect.any(Buffer),
      salt: expect.any(Buffer),
    });

    expect(
      _getOctDecryptionKey({
        encryption: "aes-128-gcm",
        kryptos,
        publicEncryptionKey: result.publicEncryptionKey,
        salt: result.salt,
      }),
    ).toEqual(result.contentEncryptionKey);
  });
});
