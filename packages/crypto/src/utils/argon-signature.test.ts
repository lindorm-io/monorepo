import { randomBytes } from "crypto";
import { CryptoError } from "../error";
import {
  assertArgonSignature,
  createArgonSignature,
  verifyArgonSignature,
} from "./argon-signature";

describe("argon-signature", () => {
  it("should resolve ", async () => {
    await expect(
      createArgonSignature({
        data: "data",
      }),
    ).resolves.toStrictEqual(expect.stringContaining("$argon2id$v=19$m=2048,t=32,p=2$"));
  });

  it("should resolve with secret", async () => {
    await expect(
      createArgonSignature({
        data: "data",
        secret: "secret",
      }),
    ).resolves.toStrictEqual(expect.stringContaining("$argon2id$v=19$m=2048,t=32,p=2$"));
  });

  it("should verify data", async () => {
    const signature = await createArgonSignature({
      data: "data",
    });

    await expect(
      verifyArgonSignature({
        data: "data",
        signature,
      }),
    ).resolves.toBe(true);
  });

  it("should verify data with salt", async () => {
    const salt = randomBytes(64).toString("hex");

    const signature = await createArgonSignature({
      data: "data",
      salt,
    });

    await expect(
      verifyArgonSignature({
        data: "data",
        signature,
      }),
    ).resolves.toBe(true);
  });

  it("should verify data with secret", async () => {
    const signature = await createArgonSignature({
      data: "data",
      secret: "secret",
    });

    await expect(
      verifyArgonSignature({
        data: "data",
        secret: "secret",
        signature,
      }),
    ).resolves.toBe(true);
  });

  it("should assert data", async () => {
    const signature = await createArgonSignature({
      data: "data",
    });

    await expect(
      assertArgonSignature({
        data: "data",
        signature,
      }),
    ).resolves.not.toThrow();
  });

  it("should verify invalid data", async () => {
    const signature = await createArgonSignature({
      data: "data",
    });

    await expect(
      verifyArgonSignature({
        data: "invalid",
        signature,
      }),
    ).resolves.toBe(false);
  });

  it("should assert invalid data", async () => {
    const signature = await createArgonSignature({
      data: "data",
    });

    await expect(
      assertArgonSignature({
        data: "invalid",
        signature,
      }),
    ).rejects.toThrow(CryptoError);
  });
});
