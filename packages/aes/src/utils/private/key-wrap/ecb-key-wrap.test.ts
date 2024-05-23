import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { ecbKeyUnwrap, ecbKeyWrap } from "./ecb-key-wrap";

describe("ecbKeyWrap", () => {
  test("should wrap and unwrap key with A128KW", () => {
    const kryptos = Kryptos.generate({ algorithm: "A128KW", type: "oct", use: "enc" });

    const contentEncryptionKey = randomBytes(128 / 8);
    const keyEncryptionKey = randomBytes(128 / 8);

    const { publicEncryptionKey } = ecbKeyWrap({
      contentEncryptionKey,
      keyEncryptionKey,
      kryptos,
    });

    expect(publicEncryptionKey).toEqual(expect.any(Buffer));

    expect(ecbKeyUnwrap({ keyEncryptionKey, kryptos, publicEncryptionKey })).toEqual({
      contentEncryptionKey,
    });
  });

  test("should wrap and unwrap key with A192KW", () => {
    const kryptos = Kryptos.generate({ algorithm: "A192KW", type: "oct", use: "enc" });

    const contentEncryptionKey = randomBytes(192 / 8);
    const keyEncryptionKey = randomBytes(192 / 8);

    const { publicEncryptionKey } = ecbKeyWrap({
      contentEncryptionKey,
      keyEncryptionKey,
      kryptos,
    });

    expect(publicEncryptionKey).toEqual(expect.any(Buffer));

    expect(ecbKeyUnwrap({ keyEncryptionKey, kryptos, publicEncryptionKey })).toEqual({
      contentEncryptionKey,
    });
  });

  test("should wrap and unwrap key with A256KW", () => {
    const kryptos = Kryptos.generate({ algorithm: "A256KW", type: "oct", use: "enc" });

    const contentEncryptionKey = randomBytes(256 / 8);
    const keyEncryptionKey = randomBytes(256 / 8);

    const { publicEncryptionKey } = ecbKeyWrap({
      contentEncryptionKey,
      keyEncryptionKey,
      kryptos,
    });

    expect(publicEncryptionKey).toEqual(expect.any(Buffer));

    expect(ecbKeyUnwrap({ keyEncryptionKey, kryptos, publicEncryptionKey })).toEqual({
      contentEncryptionKey,
    });
  });
});
