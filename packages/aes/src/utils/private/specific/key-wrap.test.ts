import { randomBytes } from "crypto";
import { TEST_OCT_KEY } from "../../../__fixtures__/keys";
import { _aesKeyUnwrap, _aesKeyWrap } from "./key-wrap";

describe("keyWrap", () => {
  test("should wrap and unwrap key with A128KW", () => {
    const kryptos = TEST_OCT_KEY.clone({ algorithm: "A128KW" });

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
    const kryptos = TEST_OCT_KEY.clone({ algorithm: "A192KW" });

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
    const kryptos = TEST_OCT_KEY.clone({ algorithm: "A256KW" });

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
