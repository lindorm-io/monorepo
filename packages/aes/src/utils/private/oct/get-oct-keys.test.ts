import { TEST_OCT_KEY } from "../../../__fixtures__/keys";
import { _getOctDecryptionKey, _getOctEncryptionKeys } from "./get-oct-keys";

describe("get-oct-keys", () => {
  test("should return oct encryption key", () => {
    expect(
      _getOctEncryptionKeys({ encryption: "aes-256-gcm", kryptos: TEST_OCT_KEY }),
    ).toEqual({
      encryptionKey: expect.any(Buffer),
      iterations: 100000,
      salt: expect.any(Buffer),
    });
  });

  test("should return oct decryption key", () => {
    expect(
      _getOctDecryptionKey({
        encryption: "aes-256-gcm",
        iterations: 100000,
        kryptos: TEST_OCT_KEY,
        salt: Buffer.from("2YGPiv+hJlaTKKkPCWayzw==", "base64"),
      }),
    ).toEqual(Buffer.from("aSy8jotDwcJJ3q2tJMs9JvzYLp+fMEY6X4Ci1PBtdg4=", "base64"));
  });
});
