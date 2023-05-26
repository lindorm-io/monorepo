import { generateKeyPair as _generateKeyPair } from "crypto";
import { generateRsaKeys } from "./generate-rsa-keys";

jest.mock("crypto");

const generateKeyPair = _generateKeyPair as unknown as jest.Mock;

describe("generateRsaKeys", () => {
  test("should resolve", async () => {
    generateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(null, "PUBLIC_KEY", "PRIVATE_KEY"),
    );

    await expect(generateRsaKeys()).resolves.toMatchSnapshot();
  });

  test("should reject", async () => {
    generateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(new Error("Error")),
    );

    await expect(generateRsaKeys()).rejects.toThrow(Error);
  });
});
