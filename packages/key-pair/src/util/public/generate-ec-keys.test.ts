import { generateKeyPair as _generateKeyPair } from "crypto";
import { generateEcKeys } from "./generate-ec-keys";

jest.mock("crypto");

const generateKeyPair = _generateKeyPair as unknown as jest.Mock;

describe("generateEcKeys", () => {
  test("should resolve", async () => {
    generateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(null, "PUBLIC_KEY", "PRIVATE_KEY"),
    );

    await expect(generateEcKeys()).resolves.toMatchSnapshot();
  });

  test("should reject", async () => {
    generateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(new Error("Error")),
    );

    await expect(generateEcKeys()).rejects.toThrow(Error);
  });
});
