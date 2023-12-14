import MockDate from "mockdate";
import { KeyPair } from "../entities";
import { KeyPairAlgorithm, KeyPairOperation, KeyPairType, NamedCurve } from "../enums";
import { KeystoreError } from "../errors";
import { Keystore } from "./Keystore";

MockDate.set("2021-02-01T08:00:00.000Z");

const privateKey = new KeyPair({
  id: "privateKey",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-02T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKey-private-key",
  publicKey: "privateKey-public-key",
  type: KeyPairType.EC,
});

const privateKeyNotSigning = new KeyPair({
  id: "privateKey",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-02T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  operations: [KeyPairOperation.VERIFY],
  privateKey: "privateKey-private-key",
  publicKey: "privateKey-public-key",
  type: KeyPairType.EC,
});

const privateKeyCopy = new KeyPair({
  id: "privateKey",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-02T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKey-private-key",
  publicKey: "privateKey-public-key",
  type: KeyPairType.EC,
});

const privateKeyExternal = new KeyPair({
  id: "privateKeyExternal",
  algorithms: [KeyPairAlgorithm.ES384],
  created: new Date("2020-01-03T01:00:00.000Z"),
  isExternal: true,
  namedCurve: NamedCurve.P384,
  originUri: "https://private.origin.uri/",
  privateKey: "privateKeyExternal-private-key",
  publicKey: "privateKeyExternal-public-key",
  type: KeyPairType.EC,
});

const privateKeyHS = new KeyPair({
  id: "privateKeyHS",
  algorithms: [KeyPairAlgorithm.HS256, KeyPairAlgorithm.HS384, KeyPairAlgorithm.HS512],
  created: new Date("2020-01-04T01:00:10.000Z"),
  privateKey: "privateKeyHS-private-key",
  type: KeyPairType.HS,
});

const privateKeyRSA = new KeyPair({
  id: "privateKeyRSA",
  algorithms: [KeyPairAlgorithm.RS256, KeyPairAlgorithm.RS384, KeyPairAlgorithm.RS512],
  created: new Date("2020-01-04T01:00:00.000Z"),
  privateKey: "privateKeyRSA-private-key",
  publicKey: "privateKeyRSA-public-key",
  type: KeyPairType.RSA,
});

const privateKeyExpired = new KeyPair({
  id: "privateKeyExpired",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-05T01:00:00.000Z"),
  expiresAt: new Date("2020-02-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKeyExpired-private-key",
  publicKey: "privateKeyExpired-public-key",
  type: KeyPairType.EC,
});

const privateKeyExpires = new KeyPair({
  id: "privateKeyExpires",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-06T01:00:00.000Z"),
  expiresAt: new Date("2022-01-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKeyExpires-private-key",
  publicKey: "privateKeyExpires-public-key",
  type: KeyPairType.EC,
});

const privateKeyNotAllowed = new KeyPair({
  id: "privateKeyNotAllowed",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-07T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  notBefore: new Date("2099-01-01T01:00:00.000Z"),
  privateKey: "privateKeyNotAllowed-private-key",
  publicKey: "privateKeyNotAllowed-public-key",
  type: KeyPairType.EC,
});

const publicKey = new KeyPair({
  id: "publicKey",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-08T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKey-public-key",
  type: KeyPairType.EC,
});

const publicKeyCopy = new KeyPair({
  id: "publicKey",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-08T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKey-public-key",
  type: KeyPairType.EC,
});

const publicKeyExternal = new KeyPair({
  id: "publicKeyExternal",
  algorithms: [KeyPairAlgorithm.ES256],
  created: new Date("2020-01-09T01:00:00.000Z"),
  isExternal: true,
  namedCurve: NamedCurve.P256,
  originUri: "https://public.origin.uri/",
  publicKey: "publicKeyExternal-public-key",
  type: KeyPairType.EC,
});

const publicKeyRSA = new KeyPair({
  id: "publicKeyRSA",
  algorithms: [KeyPairAlgorithm.RS256, KeyPairAlgorithm.RS384, KeyPairAlgorithm.RS512],
  created: new Date("2020-01-10T01:00:00.000Z"),
  publicKey: "publicKey-public-key",
  type: KeyPairType.RSA,
});

const publicKeyExpired = new KeyPair({
  id: "publicKeyExpired",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-11T01:00:00.000Z"),
  expiresAt: new Date("2020-02-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKeyExpired-public-key",
  type: KeyPairType.EC,
});

const publicKeyExpires = new KeyPair({
  id: "publicKeyExpires",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-12T01:00:00.000Z"),
  expiresAt: new Date("2022-01-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKeyExpires-public-key",
  type: KeyPairType.EC,
});

const publicKeyNotAllowed = new KeyPair({
  id: "publicKeyNotAllowed",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-13T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  notBefore: new Date("2099-01-01T01:00:00.000Z"),
  publicKey: "publicKeyNotAllowed-public-key",
  type: KeyPairType.EC,
});

jest.mock("../utils/private", () => ({
  // @ts-ignore
  ...jest.requireActual("../utils/private"),
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
      privateKeyHS,
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
        privateKeyHS,
        privateKeyRSA,
        privateKeyExternal,
        privateKey,
      ]);
    });

    test("should return all unique keys of type HS", () => {
      expect(keystore.getKeys(KeyPairType.HS)).toStrictEqual([privateKeyHS]);
    });

    test("should return all unique keys of type EC", () => {
      expect(keystore.getKeys(KeyPairType.EC)).toStrictEqual([
        publicKeyExpires,
        publicKeyExternal,
        publicKey,
        privateKeyExpires,
        privateKeyExternal,
        privateKey,
      ]);
    });

    test("should throw on expired keys", () => {
      const store = new Keystore({ keys: [privateKeyExpired, publicKeyExpired] });

      expect(() => store.getKeys()).toThrow(KeystoreError);
    });

    test("should throw on wrong type", () => {
      const store = new Keystore({ keys: [privateKeyRSA, publicKeyRSA] });

      expect(() => store.getKeys(KeyPairType.EC)).toThrow(KeystoreError);
    });
  });

  describe("getPrivateKeys", () => {
    test("should return all keys that are private", () => {
      expect(keystore.getPrivateKeys()).toStrictEqual([
        privateKeyExpires,
        privateKeyHS,
        privateKeyRSA,
        privateKeyExternal,
        privateKey,
      ]);
    });

    test("should return all keys that are private of type RSA", () => {
      expect(keystore.getPrivateKeys(KeyPairType.RSA)).toStrictEqual([privateKeyRSA]);
    });

    test("should throw on no private keys", () => {
      const store = new Keystore({ keys: [publicKey] });

      expect(() => store.getPrivateKeys()).toThrow(KeystoreError);
    });

    test("should throw on no private keys of specific type", () => {
      const store = new Keystore({ keys: [privateKeyRSA] });

      expect(() => store.getPrivateKeys(KeyPairType.EC)).toThrow(KeystoreError);
    });
  });

  describe("getSigningKey", () => {
    test("should return the current signing key", () => {
      expect(keystore.getSigningKey()).toStrictEqual(privateKeyExpires);
    });

    test("should return the current signing key of type", () => {
      expect(keystore.getSigningKey(KeyPairType.RSA)).toStrictEqual(privateKeyRSA);
    });

    test("should throw on no signing key", () => {
      const store = new Keystore({ keys: [privateKeyNotSigning] });

      expect(() => store.getSigningKey()).toThrow(KeystoreError);
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
