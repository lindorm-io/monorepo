import { KryptosKit } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { ecbKeyUnwrap, ecbKeyWrap } from "./ecb-key-wrap";

describe("ecbKeyWrap", () => {
  test("should wrap and unwrap key with A128KW", () => {
    const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128KW" });

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
    const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A192KW" });

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
    const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });

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
