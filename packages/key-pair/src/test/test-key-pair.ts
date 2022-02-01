import { KeyPair } from "../entity";
import { Algorithm, KeyType, NamedCurve } from "../enum";

export const privateKey = new KeyPair({
  id: "privateKey",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-02T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKey-private-key",
  publicKey: "privateKey-public-key",
  type: KeyType.EC,
});

export const privateKeyCopy = new KeyPair({
  id: "privateKey",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-02T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKey-private-key",
  publicKey: "privateKey-public-key",
  type: KeyType.EC,
});

export const privateKeyExternal = new KeyPair({
  id: "privateKeyExternal",
  algorithms: [Algorithm.ES384],
  created: new Date("2020-01-03T01:00:00.000Z"),
  namedCurve: NamedCurve.P384,
  external: true,
  privateKey: "privateKeyExternal-private-key",
  publicKey: "privateKeyExternal-public-key",
  type: KeyType.EC,
});

export const privateKeyRSA = new KeyPair({
  id: "privateKeyRSA",
  algorithms: [Algorithm.RS256, Algorithm.RS384, Algorithm.RS512],
  created: new Date("2020-01-04T01:00:00.000Z"),
  privateKey: "privateKeyRSA-private-key",
  publicKey: "privateKeyRSA-public-key",
  type: KeyType.RSA,
});

export const privateKeyRSAPassphrase = new KeyPair({
  id: "privateKeyRSAWithPasscode",
  algorithms: [Algorithm.RS256, Algorithm.RS384, Algorithm.RS512],
  created: new Date("2020-01-04T01:00:00.000Z"),
  passphrase: "privateKeyRSAWithPasscode-passphrase",
  privateKey: "privateKeyRSAWithPasscode-private-key",
  publicKey: "privateKeyRSAWithPasscode-public-key",
  type: KeyType.RSA,
});

export const privateKeyExpired = new KeyPair({
  id: "privateKeyExpired",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-05T01:00:00.000Z"),
  expires: new Date("2020-02-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKeyExpired-private-key",
  publicKey: "privateKeyExpired-public-key",
  type: KeyType.EC,
});

export const privateKeyExpires = new KeyPair({
  id: "privateKeyExpires",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-06T01:00:00.000Z"),
  expires: new Date("2022-01-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKeyExpires-private-key",
  publicKey: "privateKeyExpires-public-key",
  type: KeyType.EC,
});

export const privateKeyNotAllowed = new KeyPair({
  id: "privateKeyNotAllowed",
  algorithms: [Algorithm.ES512],
  allowed: new Date("2099-01-01T01:00:00.000Z"),
  created: new Date("2020-01-07T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKeyNotAllowed-private-key",
  publicKey: "privateKeyNotAllowed-public-key",
  type: KeyType.EC,
});

export const publicKey = new KeyPair({
  id: "publicKey",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-08T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKey-public-key",
  type: KeyType.EC,
});

export const publicKeyCopy = new KeyPair({
  id: "publicKey",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-08T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKey-public-key",
  type: KeyType.EC,
});

export const publicKeyExternal = new KeyPair({
  id: "publicKeyExternal",
  algorithms: [Algorithm.ES256],
  created: new Date("2020-01-09T01:00:00.000Z"),
  external: true,
  namedCurve: NamedCurve.P256,
  publicKey: "publicKeyExternal-public-key",
  type: KeyType.EC,
});

export const publicKeyRSA = new KeyPair({
  id: "publicKeyRSA",
  algorithms: [Algorithm.RS256, Algorithm.RS384, Algorithm.RS512],
  created: new Date("2020-01-10T01:00:00.000Z"),
  publicKey: "publicKey-public-key",
  type: KeyType.RSA,
});

export const publicKeyExpired = new KeyPair({
  id: "publicKeyExpired",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-11T01:00:00.000Z"),
  expires: new Date("2020-02-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKeyExpired-public-key",
  type: KeyType.EC,
});

export const publicKeyExpires = new KeyPair({
  id: "publicKeyExpires",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-12T01:00:00.000Z"),
  expires: new Date("2022-01-01T00:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKeyExpires-public-key",
  type: KeyType.EC,
});

export const publicKeyNotAllowed = new KeyPair({
  id: "publicKeyNotAllowed",
  algorithms: [Algorithm.ES512],
  allowed: new Date("2099-01-01T01:00:00.000Z"),
  created: new Date("2020-01-13T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  publicKey: "publicKeyNotAllowed-public-key",
  type: KeyType.EC,
});
