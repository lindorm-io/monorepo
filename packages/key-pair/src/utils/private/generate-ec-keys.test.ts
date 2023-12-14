import { generateKeyPair as _generateKeyPair } from "crypto";
import { generateEcKeys } from "./generate-ec-keys";

jest.mock("crypto");

const generateKeyPair = _generateKeyPair as unknown as jest.Mock;

describe("generateEcKeys", () => {
  beforeEach(() => {
    generateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(null, "PUBLIC_KEY", "PRIVATE_KEY"),
    );
  });

  afterEach(jest.clearAllMocks);

  test("should resolve", async () => {
    await expect(generateEcKeys()).resolves.toStrictEqual({
      algorithms: ["ES512"],
      namedCurve: "P-521",
      privateKey: "PRIVATE_KEY",
      publicKey: "PUBLIC_KEY",
      type: "EC",
    });

    expect(generateKeyPair).toHaveBeenCalledWith(
      "ec",
      {
        namedCurve: "P-521",
        privateKeyEncoding: { format: "pem", type: "pkcs8" },
        publicKeyEncoding: { format: "pem", type: "spki" },
      },
      expect.any(Function),
    );
  });

  test("should reject", async () => {
    generateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(new Error("Error")),
    );

    await expect(generateEcKeys()).rejects.toThrow(Error);
  });
});
