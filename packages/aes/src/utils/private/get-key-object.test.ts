import { RsaOaepHash } from "../../enums";
import { getKeyObject } from "./get-key-object";

describe("getKeyObject", () => {
  test("should resolve key object", () => {
    expect(getKeyObject("key")).toStrictEqual({ key: "key", padding: 4 });
  });

  test("should resolve key object with oaep", () => {
    expect(getKeyObject("key", RsaOaepHash.SHA256)).toStrictEqual({
      key: "key",
      padding: 4,
      oaepHash: "sha256",
    });
  });

  test("should resolve key object with passphrase", () => {
    expect(getKeyObject({ key: "key", passphrase: "passphrase" })).toStrictEqual({
      key: "key",
      padding: 4,
      passphrase: "passphrase",
    });
  });
});
