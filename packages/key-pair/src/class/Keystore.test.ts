import MockDate from "mockdate";
import { Keystore } from "./Keystore";
import {
  privateKey,
  privateKeyExternal,
  privateKeyRSA,
  privateKeyExpired,
  privateKeyExpires,
  privateKeyNotAllowed,
  publicKey,
  publicKeyExternal,
  publicKeyRSA,
  publicKeyExpired,
  publicKeyExpires,
  publicKeyNotAllowed,
  privateKeyCopy,
  publicKeyCopy,
} from "../test";

MockDate.set("2021-02-01T08:00:00.000Z");

jest.mock("../util", () => ({
  // @ts-ignore
  ...jest.requireActual("../util"),
  decodeKeys: () => ({
    privateKey: "privateKey",
    publicKey: "publicKey",
  }),
  encodeKeys: () => ({
    crv: "crv",
    d: "d",
    dp: "dp",
    dq: "dq",
    e: "e",
    n: "n",
    p: "p",
    q: "q",
    qi: "qi",
    x: "x",
    y: "y",
  }),
}));

describe("Keystore.ts", () => {
  const keystore = new Keystore({
    keys: [
      privateKey,
      privateKeyCopy,
      privateKeyExternal,
      privateKeyRSA,
      privateKeyExpired,
      privateKeyExpires,
      privateKeyNotAllowed,
      publicKey,
      publicKeyCopy,
      publicKeyExternal,
      publicKeyRSA,
      publicKeyExpired,
      publicKeyExpires,
      publicKeyNotAllowed,
    ],
  });

  describe("constructor", () => {
    test("should throw if initialised without keys", () => {
      expect(() => new Keystore({ keys: [] })).toThrow(Error);
    });
  });

  describe("getJWKS", () => {
    test("should return private keys", () => {
      expect(keystore.getJWKS({ exposePrivate: true })).toMatchSnapshot();
    });

    test("should return external jwks", () => {
      expect(keystore.getJWKS({ exposeExternal: true })).toMatchSnapshot();
    });

    test("should return public jwks", () => {
      expect(keystore.getJWKS()).toMatchSnapshot();
    });
  });

  describe("getKey", () => {
    test("should return a specific key", () => {
      expect(keystore.getKey(privateKey.id)).toStrictEqual(privateKey);
    });

    test("should throw when specific key cannot be found", () => {
      expect(() => keystore.getKey("wrong")).toThrow(Error);
    });

    test("should throw when unable to find key that is not usable", () => {
      expect(() => keystore.getKey(publicKeyNotAllowed.id)).toThrow(Error);
    });
  });

  describe("getKeys", () => {
    test("should return all unique keys that can be used", () => {
      expect(keystore.getKeys()).toStrictEqual([
        publicKeyExpires,
        publicKeyRSA,
        publicKeyExternal,
        publicKey,
        privateKeyExpires,
        privateKeyRSA,
        privateKeyExternal,
        privateKey,
      ]);
    });
  });

  describe("getPrivateKeys", () => {
    test("should return all keys that are private", () => {
      expect(keystore.getPrivateKeys()).toStrictEqual([
        privateKeyExpires,
        privateKeyRSA,
        privateKey,
        privateKeyExternal,
      ]);
    });
  });

  describe("getSigningKey", () => {
    test("should return the current key", () => {
      expect(keystore.getSigningKey()).toStrictEqual(privateKeyExpires);
    });
  });

  describe("getTTL", () => {
    test("should return TTL for key that will expire", () => {
      expect(Keystore.getTTL(publicKeyExpires)).toStrictEqual({
        seconds: 28828800,
        milliseconds: 28828800000,
      });
    });

    test("should return undefined for expired key", () => {
      expect(Keystore.getTTL(privateKeyExpired)).toBeUndefined();
    });

    test("should return undefined for key without expiry", () => {
      expect(Keystore.getTTL(privateKey)).toBeUndefined();
    });
  });
});
