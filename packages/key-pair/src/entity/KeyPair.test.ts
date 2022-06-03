import MockDate from "mockdate";
import { KeyPair } from "./KeyPair";
import { Algorithm, KeyType, NamedCurve } from "../enum";

MockDate.set("2020-01-01T08:00:00.000Z");

const privateKey = new KeyPair({
  id: "privateKey",
  algorithms: [Algorithm.ES512],
  created: new Date("2020-01-02T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKey-private-key",
  publicKey: "privateKey-public-key",
  type: KeyType.EC,
});

const privateKeyRSAPassphrase = new KeyPair({
  id: "privateKeyRSAWithPasscode",
  algorithms: [Algorithm.RS256, Algorithm.RS384, Algorithm.RS512],
  created: new Date("2020-01-04T01:00:00.000Z"),
  passphrase: "privateKeyRSAWithPasscode-passphrase",
  privateKey: "privateKeyRSAWithPasscode-private-key",
  publicKey: "privateKeyRSAWithPasscode-public-key",
  type: KeyType.RSA,
});

jest.mock("../util", () => ({
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

describe("KeyPair.ts", () => {
  let keyPair: KeyPair;

  beforeEach(() => {
    keyPair = new KeyPair({
      id: "259ff47d-e334-4784-a478-04bf6d6b5d84",
      algorithms: [Algorithm.ES512, Algorithm.ES384, Algorithm.ES256],
      created: new Date("2019-01-01T08:00:00.000Z"),
      allowed: new Date("2019-01-01T08:00:00.000Z"),
      expires: new Date("2020-01-01T08:00:00.000Z"),
      namedCurve: NamedCurve.P521,
      privateKey: "privateKey",
      publicKey: "publicKey",
      type: KeyType.EC,
    });
  });

  test("should have all data", () => {
    expect(keyPair).toMatchSnapshot();
  });

  test("should have optional data", () => {
    expect(
      new KeyPair({
        id: "02dc19eb-2b8b-4a83-a0c0-9ac2b306bb9a",
        algorithms: [Algorithm.RS256, Algorithm.RS384],
        publicKey: "publicKey",
        type: KeyType.RSA,
      }),
    ).toMatchSnapshot();
  });

  test("should get/set allowed", () => {
    expect(keyPair.allowed).toStrictEqual(new Date("2019-01-01T08:00:00.000Z"));

    const allowed = new Date("2019-03-01T08:00:00.000Z");
    keyPair.allowed = allowed;

    expect(keyPair.allowed).toBe(allowed);
  });

  test("should get/set expires", () => {
    expect(keyPair.expires).toStrictEqual(new Date("2020-01-01T08:00:00.000Z"));

    const expires = new Date("2021-01-01T00:00:01.000Z");
    keyPair.expires = expires;

    expect(keyPair.expires).toBe(expires);
  });

  test("should get/set preferredAlgorithm", () => {
    expect(keyPair.preferredAlgorithm).toBe(Algorithm.ES512);

    const preferredAlgorithm = Algorithm.ES384;
    keyPair.preferredAlgorithm = preferredAlgorithm;

    expect(keyPair.preferredAlgorithm).toBe(preferredAlgorithm);
  });

  test("should validate schema", async () => {
    await expect(keyPair.schemaValidation()).resolves.toBeUndefined();
  });

  test("should get json", () => {
    expect(keyPair.toJSON()).toMatchSnapshot();
  });

  describe("toJWK", () => {
    test("should convert private key to JWK", () => {
      expect(privateKey.toJWK(true)).toMatchSnapshot();
    });

    test("should convert private RSA key with passphrase to JWK", () => {
      expect(privateKeyRSAPassphrase.toJWK(true)).toMatchSnapshot();
    });
  });

  test("should create a new KeyPair from JWK", () => {
    expect(
      KeyPair.fromJWK({
        alg: "ES512",
        crv: "P-521",
        // @ts-ignore
        key_ops: [],
        kid: "391a4598-5dc6-4e3c-b1d9-a971ac55b3bb",
        kty: "EC",
        use: "sig",
        d: "AJk+YtHhPoobRdEZXzK9URIT7mB7dvGYeH6TmK8kP06Ha/lVRX8f/zD9vc9CRik+fb6XkcTMxktFNve1Xkq3HbMu",
        x: "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz",
        y: "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW+s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW",
      }),
    ).toMatchSnapshot();
  });
});
