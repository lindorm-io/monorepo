import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { gcmKeyUnwrap, gcmKeyWrap } from "./gcm-key-wrap";

describe("gcmKeyWrap", () => {
  test("should wrap and unwrap key with A128GCMKW", () => {
    const kryptos = Kryptos.generate({ algorithm: "A128GCMKW", type: "oct", use: "enc" });

    const contentEncryptionKey = randomBytes(128 / 8);
    const keyEncryptionKey = randomBytes(128 / 8);

    const { publicEncryptionKey, publicEncryptionIv, publicEncryptionTag } = gcmKeyWrap({
      contentEncryptionKey,
      keyEncryptionKey,
      kryptos,
    });

    expect(publicEncryptionKey).toEqual(expect.any(Buffer));

    expect(
      gcmKeyUnwrap({
        keyEncryptionKey,
        kryptos,
        publicEncryptionKey,
        publicEncryptionIv,
        publicEncryptionTag,
      }),
    ).toEqual({
      contentEncryptionKey,
    });
  });

  test("should wrap and unwrap key with A192GCMKW", () => {
    const kryptos = Kryptos.generate({ algorithm: "A192GCMKW", type: "oct", use: "enc" });

    const contentEncryptionKey = randomBytes(192 / 8);
    const keyEncryptionKey = randomBytes(192 / 8);

    const { publicEncryptionKey, publicEncryptionIv, publicEncryptionTag } = gcmKeyWrap({
      contentEncryptionKey,
      keyEncryptionKey,
      kryptos,
    });

    expect(publicEncryptionKey).toEqual(expect.any(Buffer));

    expect(
      gcmKeyUnwrap({
        keyEncryptionKey,
        kryptos,
        publicEncryptionIv,
        publicEncryptionKey,
        publicEncryptionTag,
      }),
    ).toEqual({
      contentEncryptionKey,
    });
  });

  test("should wrap and unwrap key with A256GCMKW", () => {
    const kryptos = Kryptos.generate({ algorithm: "A256GCMKW", type: "oct", use: "enc" });

    const contentEncryptionKey = randomBytes(256 / 8);
    const keyEncryptionKey = randomBytes(256 / 8);

    const { publicEncryptionKey, publicEncryptionIv, publicEncryptionTag } = gcmKeyWrap({
      contentEncryptionKey,
      keyEncryptionKey,
      kryptos,
    });

    expect(publicEncryptionKey).toEqual(expect.any(Buffer));

    expect(
      gcmKeyUnwrap({
        keyEncryptionKey,
        kryptos,
        publicEncryptionKey,
        publicEncryptionIv,
        publicEncryptionTag,
      }),
    ).toEqual({
      contentEncryptionKey,
    });
  });
});
