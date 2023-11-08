import MockDate from "mockdate";
import { KeyPair } from "../../entity";
import { Algorithm, KeyType, NamedCurve } from "../../enum";
import { isKeyAllowed, isKeyExpired, isKeyPrivate, isKeyUsable } from "./keystore";

MockDate.set("2021-01-01T08:00:00.000Z");

const privateKey = new KeyPair({
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
  isExternal: true,
  namedCurve: NamedCurve.P384,
  originUri: "https://private.origin.uri/",
  privateKey: "privateKeyExternal-private-key",
  publicKey: "privateKeyExternal-public-key",
  type: KeyType.EC,
});

const privateKeyHS = new KeyPair({
  id: "privateKeyHS",
  algorithms: [Algorithm.HS256, Algorithm.HS384, Algorithm.HS512],
  created: new Date("2020-01-04T01:00:10.000Z"),
  privateKey: "privateKeyHS-private-key",
  type: KeyType.HS,
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
  expiresAt: new Date("2020-02-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKeyExpired-private-key",
  publicKey: "privateKeyExpired-public-key",
  type: KeyType.EC,
});

const privateKeyExpires = new KeyPair({
  id: "privateKeyExpires",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-06T01:00:00.000Z"),
  expiresAt: new Date("2022-01-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKeyExpires-private-key",
  publicKey: "privateKeyExpires-public-key",
  type: KeyType.EC,
});

const privateKeyNotAllowed = new KeyPair({
  id: "privateKeyNotAllowed",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-07T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  notBefore: new Date("2099-01-01T01:00:00.000Z"),
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

const publicKeyExternal = new KeyPair({
  id: "publicKeyExternal",
  algorithms: [Algorithm.ES256],
  created: new Date("2020-01-09T01:00:00.000Z"),
  isExternal: true,
  namedCurve: NamedCurve.P256,
  originUri: "https://public.origin.uri/",
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
  expiresAt: new Date("2020-02-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKeyExpired-public-key",
  type: KeyType.EC,
});

const publicKeyExpires = new KeyPair({
  id: "publicKeyExpires",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-12T01:00:00.000Z"),
  expiresAt: new Date("2022-01-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKeyExpires-public-key",
  type: KeyType.EC,
});

const publicKeyNotAllowed = new KeyPair({
  id: "publicKeyNotAllowed",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-13T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  notBefore: new Date("2099-01-01T01:00:00.000Z"),
  publicKey: "publicKeyNotAllowed-public-key",
  type: KeyType.EC,
});

describe("keystore", () => {
  describe("isKeyAllowed", () => {
    it("should resolve if key is expired", () => {
      expect(isKeyAllowed(privateKey)).toBe(true);
      expect(isKeyAllowed(privateKeyExternal)).toBe(true);
      expect(isKeyAllowed(privateKeyHS)).toBe(true);
      expect(isKeyAllowed(privateKeyRSA)).toBe(true);
      expect(isKeyAllowed(privateKeyExpired)).toBe(true);
      expect(isKeyAllowed(privateKeyExpires)).toBe(true);
      expect(isKeyAllowed(privateKeyNotAllowed)).toBe(false);

      expect(isKeyAllowed(publicKey)).toBe(true);
      expect(isKeyAllowed(publicKeyExternal)).toBe(true);
      expect(isKeyAllowed(publicKeyRSA)).toBe(true);
      expect(isKeyAllowed(publicKeyExpired)).toBe(true);
      expect(isKeyAllowed(publicKeyExpires)).toBe(true);
      expect(isKeyAllowed(publicKeyNotAllowed)).toBe(false);
    });
  });

  describe("isKeyExpired", () => {
    it("should resolve if key is expired", () => {
      expect(isKeyExpired(privateKey)).toBe(false);
      expect(isKeyExpired(privateKeyExternal)).toBe(false);
      expect(isKeyExpired(privateKeyHS)).toBe(false);
      expect(isKeyExpired(privateKeyRSA)).toBe(false);
      expect(isKeyExpired(privateKeyExpired)).toBe(true);
      expect(isKeyExpired(privateKeyExpires)).toBe(false);
      expect(isKeyExpired(privateKeyNotAllowed)).toBe(false);

      expect(isKeyExpired(publicKey)).toBe(false);
      expect(isKeyExpired(publicKeyExternal)).toBe(false);
      expect(isKeyExpired(publicKeyRSA)).toBe(false);
      expect(isKeyExpired(publicKeyExpired)).toBe(true);
      expect(isKeyExpired(publicKeyExpires)).toBe(false);
      expect(isKeyExpired(publicKeyNotAllowed)).toBe(false);
    });
  });

  describe("isKeyPrivate", () => {
    it("should resolve if private key is a string", () => {
      expect(isKeyPrivate(privateKey)).toBe(true);
      expect(isKeyPrivate(privateKeyExternal)).toBe(true);
      expect(isKeyPrivate(privateKeyHS)).toBe(true);
      expect(isKeyPrivate(privateKeyRSA)).toBe(true);
      expect(isKeyPrivate(privateKeyExpired)).toBe(true);
      expect(isKeyPrivate(privateKeyExpires)).toBe(true);
      expect(isKeyPrivate(privateKeyNotAllowed)).toBe(true);

      expect(isKeyPrivate(publicKey)).toBe(false);
      expect(isKeyPrivate(publicKeyExternal)).toBe(false);
      expect(isKeyPrivate(publicKeyRSA)).toBe(false);
      expect(isKeyPrivate(publicKeyExpired)).toBe(false);
      expect(isKeyPrivate(publicKeyExpires)).toBe(false);
      expect(isKeyPrivate(publicKeyNotAllowed)).toBe(false);
    });
  });

  describe("isKeyUsable", () => {
    it("should resolve if key is allowed and not expired", () => {
      expect(isKeyUsable(privateKey)).toBe(true);
      expect(isKeyUsable(privateKeyExternal)).toBe(true);
      expect(isKeyUsable(privateKeyHS)).toBe(true);
      expect(isKeyUsable(privateKeyRSA)).toBe(true);
      expect(isKeyUsable(privateKeyExpired)).toBe(false);
      expect(isKeyUsable(privateKeyExpires)).toBe(true);
      expect(isKeyUsable(privateKeyNotAllowed)).toBe(false);

      expect(isKeyUsable(publicKey)).toBe(true);
      expect(isKeyUsable(publicKeyExternal)).toBe(true);
      expect(isKeyUsable(publicKeyRSA)).toBe(true);
      expect(isKeyUsable(publicKeyExpired)).toBe(false);
      expect(isKeyUsable(publicKeyExpires)).toBe(true);
      expect(isKeyUsable(publicKeyNotAllowed)).toBe(false);
    });
  });
});
