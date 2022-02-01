import { KeyPair } from "../../entity";
import { KeyType, NamedCurve } from "../../enum";
import { generateKeyPair } from "./generate-key-pair";

jest.mock("crypto", () => ({
  // @ts-ignore
  ...jest.requireActual("crypto"),
  generateKeyPair: (type: string, options: any, callback: any) =>
    callback(null, "publicKey", "privateKey", type, options),
}));

describe("generateKeyPair", () => {
  afterEach(jest.clearAllMocks);

  test("should generate KeyPair", async () => {
    await expect(generateKeyPair({ type: KeyType.EC })).resolves.toStrictEqual(expect.any(KeyPair));
  });

  test("should generate EC KeyPair", async () => {
    await expect(generateKeyPair({ type: KeyType.EC })).resolves.toStrictEqual(
      expect.objectContaining({
        algorithms: ["ES512"],
        expires: null,
        external: false,
        namedCurve: "P-521",
        passphrase: null,
        preferredAlgorithm: "ES512",
        privateKey: "privateKey",
        publicKey: "publicKey",
        type: "EC",
      }),
    );
  });

  test("should generate EC KeyPair with namedCurve", async () => {
    await expect(
      generateKeyPair({ namedCurve: NamedCurve.P384, type: KeyType.EC }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        algorithms: ["ES384"],
        expires: null,
        external: false,
        namedCurve: "P-384",
        passphrase: null,
        preferredAlgorithm: "ES384",
        privateKey: "privateKey",
        publicKey: "publicKey",
        type: "EC",
      }),
    );
  });

  test("should generate RSA KeyPair", async () => {
    await expect(generateKeyPair({ type: KeyType.RSA })).resolves.toStrictEqual(
      expect.objectContaining({
        algorithms: ["RS256", "RS384", "RS512"],
        expires: null,
        external: false,
        namedCurve: null,
        passphrase: null,
        preferredAlgorithm: "RS512",
        privateKey: "privateKey",
        publicKey: "publicKey",
        type: "RSA",
      }),
    );
  });

  test("should generate RSA KeyPair with passphrase", async () => {
    await expect(generateKeyPair({ passphrase: "pass", type: KeyType.RSA })).resolves.toStrictEqual(
      expect.objectContaining({
        algorithms: ["RS256", "RS384", "RS512"],
        expires: null,
        external: false,
        namedCurve: null,
        passphrase: "pass",
        preferredAlgorithm: "RS512",
        privateKey: "privateKey",
        publicKey: "publicKey",
        type: "RSA",
      }),
    );
  });
});
