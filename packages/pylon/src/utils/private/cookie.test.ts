import { isAesTokenised } from "@lindorm/aes";
import { B64 } from "@lindorm/b64";
import { IKryptos } from "@lindorm/kryptos";
import { decodeCookieValue, encodeCookieValue, getCookieEncryptionKeys } from "./cookie";

describe("cookie", () => {
  let keys: Array<IKryptos>;

  beforeEach(() => {
    keys = getCookieEncryptionKeys({
      encryptionKeys: ["short", "longer-secret", "abcdefghijklmnopqrstuvwxyz_0123456789"],
    });
  });

  test("should get cookie encryption kryptos keys", () => {
    expect(keys).toHaveLength(3);

    const key0 = keys[0].export("b64").privateKey;
    const key1 = keys[1].export("b64").privateKey;
    const key2 = keys[2].export("b64").privateKey;

    expect(key0).toEqual("c2hvcnQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(B64.toString(key0!)).toEqual(expect.stringContaining("short"));

    expect(key1).toEqual("bG9uZ2VyLXNlY3JldAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(B64.toString(key1!)).toEqual(expect.stringContaining("longer-secret"));

    expect(key2).toEqual("YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpfMDEyMzQ");
    expect(B64.toString(key2!)).toEqual("abcdefghijklmnopqrstuvwxyz_01234");
  });

  test("should encode cookie value", () => {
    const encoded = encodeCookieValue("test", keys, { encrypted: false });

    expect(B64.decode(encoded)).toEqual("test");
  });

  test("should encode encrypted cookie value", () => {
    const encoded = encodeCookieValue("test", keys);
    const aes = B64.decode(encoded);

    expect(isAesTokenised(aes)).toEqual(true);
  });

  test("should decode cookie value", () => {
    expect(decodeCookieValue("dGVzdA", keys)).toEqual("test");
  });

  test("should decode cookie value as array", () => {
    expect(decodeCookieValue("WyJoZWxsbyJd", keys)).toEqual(["hello"]);
  });

  test("should decode cookie value as record", () => {
    expect(decodeCookieValue("eyJoZWxsbyI6ImhlbGxvIn0", keys)).toEqual({
      hello: "hello",
    });
  });

  test("should decode encrypted cookie value", () => {
    expect(
      decodeCookieValue(
        "JEEyNTZHQ00kdj05LGtpZD0yY2Q1ZjMwNi05MWQwLTRmYzgtODJiOC01MmVmZTYyNWM1YzYsYWxnPWRpcixpdj1wcTRxNFNEcVhBVjFrQ3BILHRhZz13WlVJejJTczBfQWUtY0VoTWZjLVlnJGtjeU05LWJXJA",
        keys,
      ),
    ).toEqual("test");
  });
});
