import {
  generateKeyPair as _cryptoGenerateKeyPair,
  randomBytes as _randomBytes,
  randomUUID as _randomUUID,
} from "crypto";
import MockDate from "mockdate";
import { KeyPairType, NamedCurve } from "../enums";
import { generateKeyPair } from "./generate-key-pair";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("crypto");

const cryptoGenerateKeyPair = _cryptoGenerateKeyPair as unknown as jest.Mock;
const randomBytes = _randomBytes as unknown as jest.Mock;
const randomUUID = _randomUUID as unknown as jest.Mock;

describe("generateKeyPair", () => {
  beforeEach(() => {
    cryptoGenerateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(null, "PUBLIC_KEY", "PRIVATE_KEY"),
    );
    randomBytes.mockReturnValue(Buffer.from("HS_PRIVATE_KEY"));
    randomUUID.mockReturnValue("011ca5fd-abf4-4c6f-a349-59df20c48ead");
  });

  afterEach(jest.clearAllMocks);

  test("should generate EC KeyPair", async () => {
    await expect(
      generateKeyPair({ type: KeyPairType.EC, namedCurve: NamedCurve.P384 }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        algorithms: ["ES384"],
        expiresAt: null,
        isExternal: false,
        namedCurve: "P-384",
        notBefore: new Date("2021-01-01T08:00:00.000Z"),
        operations: ["sign", "verify"],
        originUri: null,
        ownerId: null,
        passphrase: null,
        preferredAlgorithm: "ES384",
        privateKey: "PRIVATE_KEY",
        publicKey: "PUBLIC_KEY",
        type: "EC",
      }),
    );
  });

  test("should generate HS KeyPair", async () => {
    await expect(
      generateKeyPair({ type: KeyPairType.HS, originUri: "https://origin.uri" }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        algorithms: ["HS256", "HS384", "HS512"],
        expiresAt: null,
        isExternal: false,
        namedCurve: null,
        notBefore: new Date("2021-01-01T08:00:00.000Z"),
        operations: ["sign", "verify"],
        originUri: "https://origin.uri",
        ownerId: null,
        passphrase: null,
        preferredAlgorithm: "HS512",
        privateKey: "48535f505249564154455f4b4559",
        publicKey: null,
        type: "HS",
      }),
    );
  });
});
