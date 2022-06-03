import MockDate from "mockdate";
import { Keystore } from "./Keystore";
import { Algorithm, KeyType, NamedCurve } from "../enum";
import { KeyPair } from "../entity";

MockDate.set("2021-02-01T08:00:00.000Z");

const privateKey = new KeyPair({
  id: "privateKey",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-02T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKey-private-key",
  publicKey: "privateKey-public-key",
  type: KeyType.EC,
});

const privateKeyCopy = new KeyPair({
  id: "privateKey",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-02T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKey-private-key",
  publicKey: "privateKey-public-key",
  type: KeyType.EC,
});

const privateKeyExternal = new KeyPair({
  id: "privateKeyExternal",
  algorithms: [Algorithm.ES384],
  created: new Date("2020-01-03T01:00:00.000Z"),
  namedCurve: NamedCurve.P384,
  external: true,
  privateKey: "privateKeyExternal-private-key",
  publicKey: "privateKeyExternal-public-key",
  type: KeyType.EC,
});

const privateKeyRSA = new KeyPair({
  id: "privateKeyRSA",
  algorithms: [Algorithm.RS256, Algorithm.RS384, Algorithm.RS512],
  created: new Date("2020-01-04T01:00:00.000Z"),
  privateKey: "privateKeyRSA-private-key",
  publicKey: "privateKeyRSA-public-key",
  type: KeyType.RSA,
});

const privateKeyExpired = new KeyPair({
  id: "privateKeyExpired",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-05T01:00:00.000Z"),
  expires: new Date("2020-02-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKeyExpired-private-key",
  publicKey: "privateKeyExpired-public-key",
  type: KeyType.EC,
});

const privateKeyExpires = new KeyPair({
  id: "privateKeyExpires",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-06T01:00:00.000Z"),
  expires: new Date("2022-01-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKeyExpires-private-key",
  publicKey: "privateKeyExpires-public-key",
  type: KeyType.EC,
});

const privateKeyNotAllowed = new KeyPair({
  id: "privateKeyNotAllowed",
  algorithms: [Algorithm.ES512],
  allowed: new Date("2099-01-01T01:00:00.000Z"),
  created: new Date("2020-01-07T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKeyNotAllowed-private-key",
  publicKey: "privateKeyNotAllowed-public-key",
  type: KeyType.EC,
});

const publicKey = new KeyPair({
  id: "publicKey",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-08T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKey-public-key",
  type: KeyType.EC,
});

const publicKeyCopy = new KeyPair({
  id: "publicKey",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-08T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKey-public-key",
  type: KeyType.EC,
});

const publicKeyExternal = new KeyPair({
  id: "publicKeyExternal",
  algorithms: [Algorithm.ES256],
  created: new Date("2020-01-09T01:00:00.000Z"),
  external: true,
  namedCurve: NamedCurve.P256,
  publicKey: "publicKeyExternal-public-key",
  type: KeyType.EC,
});

const publicKeyRSA = new KeyPair({
  id: "publicKeyRSA",
  algorithms: [Algorithm.RS256, Algorithm.RS384, Algorithm.RS512],
  created: new Date("2020-01-10T01:00:00.000Z"),
  publicKey: "publicKey-public-key",
  type: KeyType.RSA,
});

const publicKeyExpired = new KeyPair({
  id: "publicKeyExpired",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-11T01:00:00.000Z"),
  expires: new Date("2020-02-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKeyExpired-public-key",
  type: KeyType.EC,
});

const publicKeyExpires = new KeyPair({
  id: "publicKeyExpires",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-12T01:00:00.000Z"),
  expires: new Date("2022-01-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKeyExpires-public-key",
  type: KeyType.EC,
});

const publicKeyNotAllowed = new KeyPair({
  id: "publicKeyNotAllowed",
  algorithms: [Algorithm.ES512],
  allowed: new Date("2099-01-01T01:00:00.000Z"),
  created: new Date("2020-01-13T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKeyNotAllowed-public-key",
  type: KeyType.EC,
});

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

  describe("getKeys (with type)", () => {
    test("should return all unique keys of type", () => {
      expect(keystore.getKeys(KeyType.EC)).toStrictEqual([
        publicKeyExpires,
        publicKeyExternal,
        publicKey,
        privateKeyExpires,
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

  describe("getPrivateKeys (type)", () => {
    test("should return all keys that are private of type", () => {
      expect(keystore.getPrivateKeys(KeyType.RSA)).toStrictEqual([privateKeyRSA]);
    });
  });

  describe("getSigningKey", () => {
    test("should return the current key", () => {
      expect(keystore.getSigningKey()).toStrictEqual(privateKeyExpires);
    });
  });

  describe("getSigningKey (type)", () => {
    test("should return the current key of type", () => {
      expect(keystore.getSigningKey(KeyType.RSA)).toStrictEqual(privateKeyRSA);
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
