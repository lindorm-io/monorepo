import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { _aesKeyUnwrap, _aesKeyWrap } from "./key-wrap";

describe("keyWrap", () => {
  test("should wrap and unwrap key with A128KW", () => {
    const kryptos = Kryptos.generate({ algorithm: "A128KW", type: "oct", use: "enc" });

    const contentEncryptionKey = randomBytes(128 / 8);
    const keyEncryptionKey = randomBytes(128 / 8);

    const wrappedKey = _aesKeyWrap({
      contentEncryptionKey,
      keyEncryptionKey,
      kryptos,
    });

    expect(wrappedKey).toEqual(expect.any(Buffer));

    expect(_aesKeyUnwrap({ keyEncryptionKey, kryptos, wrappedKey })).toEqual(
      contentEncryptionKey,
    );
  });

  test("should wrap and unwrap key with A192KW", () => {
    const kryptos = Kryptos.generate({ algorithm: "A192KW", type: "oct", use: "enc" });

    const contentEncryptionKey = randomBytes(192 / 8);
    const keyEncryptionKey = randomBytes(192 / 8);

    const wrappedKey = _aesKeyWrap({
      contentEncryptionKey,
      keyEncryptionKey,
      kryptos,
    });

    expect(wrappedKey).toEqual(expect.any(Buffer));

    expect(_aesKeyUnwrap({ keyEncryptionKey, kryptos, wrappedKey })).toEqual(
      contentEncryptionKey,
    );
  });

  test("should wrap and unwrap key with A256KW", () => {
    const kryptos = Kryptos.generate({ algorithm: "A256KW", type: "oct", use: "enc" });

    const contentEncryptionKey = randomBytes(256 / 8);
    const keyEncryptionKey = randomBytes(256 / 8);

    const wrappedKey = _aesKeyWrap({
      contentEncryptionKey,
      keyEncryptionKey,
      kryptos,
    });

    expect(wrappedKey).toEqual(expect.any(Buffer));

    expect(_aesKeyUnwrap({ keyEncryptionKey, kryptos, wrappedKey })).toEqual(
      contentEncryptionKey,
    );
  });
});
