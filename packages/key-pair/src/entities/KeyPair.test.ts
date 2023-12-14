import MockDate from "mockdate";
import { KeyPairAlgorithm, KeyPairType, NamedCurve } from "../enums";
import { KeyPair } from "./KeyPair";

MockDate.set("2020-01-01T08:00:00.000Z");

const privateKey = new KeyPair({
  id: "privateKey",
  algorithms: [KeyPairAlgorithm.ES512],
  created: new Date("2020-01-02T01:00:00.000Z"),
  namedCurve: NamedCurve.P521,
  privateKey: "privateKey-private-key",
  publicKey: "privateKey-public-key",
  type: KeyPairType.EC,
});

const privateKeyRSAPassphrase = new KeyPair({
  id: "privateKeyRSAWithPasscode",
  algorithms: [KeyPairAlgorithm.RS256, KeyPairAlgorithm.RS384, KeyPairAlgorithm.RS512],
  created: new Date("2020-01-04T01:00:00.000Z"),
  passphrase: "privateKeyRSAWithPasscode-passphrase",
  privateKey: "privateKeyRSAWithPasscode-private-key",
  publicKey: "privateKeyRSAWithPasscode-public-key",
  type: KeyPairType.RSA,
});

jest.mock("../utils/private", () => ({
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
      algorithms: [KeyPairAlgorithm.ES512, KeyPairAlgorithm.ES384, KeyPairAlgorithm.ES256],
      created: new Date("2019-01-01T08:00:00.000Z"),
      expiresAt: new Date("2020-01-01T08:00:00.000Z"),
      namedCurve: NamedCurve.P521,
      notBefore: new Date("2019-01-01T08:00:00.000Z"),
      originUri: "https://origin.uri",
      ownerId: "e4edc190-6dbc-47eb-b144-2e9624f91f4a",
      privateKey: "privateKey",
      publicKey: "publicKey",
      type: KeyPairType.EC,
    });
  });

  test("should have all data", () => {
    expect(keyPair).toMatchSnapshot();
  });

  test("should have optional data", () => {
    expect(
      new KeyPair({
        id: "02dc19eb-2b8b-4a83-a0c0-9ac2b306bb9a",
        algorithms: [KeyPairAlgorithm.RS256, KeyPairAlgorithm.RS384],
        publicKey: "publicKey",
        type: KeyPairType.RSA,
      }),
    ).toMatchSnapshot();
  });

  test("should get/set notBefore", () => {
    expect(keyPair.notBefore).toStrictEqual(new Date("2019-01-01T08:00:00.000Z"));

    const notBefore = new Date("2019-03-01T08:00:00.000Z");
    keyPair.notBefore = notBefore;

    expect(keyPair.notBefore).toBe(notBefore);
  });

  test("should get/set expiresAt", () => {
    expect(keyPair.expiresAt).toStrictEqual(new Date("2020-01-01T08:00:00.000Z"));

    const expiresAt = new Date("2021-01-01T00:00:01.000Z");
    keyPair.expiresAt = expiresAt;

    expect(keyPair.expiresAt).toBe(expiresAt);
  });

  test("should get/set preferredAlgorithm", () => {
    expect(keyPair.preferredAlgorithm).toBe(KeyPairAlgorithm.ES512);

    const preferredAlgorithm = KeyPairAlgorithm.ES384;
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
        origin: "https://origin.uri",
        use: "sig",
        d: "AJk+YtHhPoobRdEZXzK9URIT7mB7dvGYeH6TmK8kP06Ha/lVRX8f/zD9vc9CRik+fb6XkcTMxktFNve1Xkq3HbMu",
        x: "AAsJtfdgSmaSxsm1swOSCodmSxeEwxQ1vcdkLVySpZAGLcGZYNIvJ9cUtQGQc9S3CDvjkR0bkrxq4HLYqC4Kwodz",
        y: "AJcSMpJWmZ97gv03gXIIbH57p01RN6CpVcUTXW+s4NxnQ6UDhuWKeyBdB7F14rXQZQKhvluoGpjvv6ON4bdk2wuW",
      }),
    ).toMatchSnapshot();
  });
});
