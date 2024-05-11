import { ArgonError } from "../../errors";
import { _assertArgonHash, _createArgonHash, _verifyArgonHash } from "./argon-hash";

describe("argon-hash", () => {
  it("should resolve", async () => {
    await expect(_createArgonHash({ data: "data" })).resolves.toStrictEqual(
      expect.stringContaining("$argon2id$v=19$m=65536,t=12,p=8$"),
    );
  });

  it("should resolve with secret", async () => {
    await expect(_createArgonHash({ data: "data", secret: "secret" })).resolves.toStrictEqual(
      expect.stringContaining("$argon2id$v=19$m=65536,t=12,p=8$"),
    );
  });

  it("should verify data", async () => {
    const hash = await _createArgonHash({ data: "data" });

    await expect(_verifyArgonHash({ data: "data", hash })).resolves.toBe(true);
  });

  it("should verify data with secret", async () => {
    const hash = await _createArgonHash({ data: "data", secret: "secret" });

    await expect(_verifyArgonHash({ data: "data", hash, secret: "secret" })).resolves.toBe(true);
  });

  it("should assert data", async () => {
    const hash = await _createArgonHash({ data: "data" });

    await expect(_assertArgonHash({ data: "data", hash })).resolves.not.toThrow();
  });

  it("should assert data with secret", async () => {
    const hash = await _createArgonHash({ data: "data", secret: "secret" });

    await expect(_assertArgonHash({ data: "data", hash, secret: "secret" })).resolves.not.toThrow();
  });

  it("should verify invalid data", async () => {
    const hash = await _createArgonHash({ data: "data" });

    await expect(_verifyArgonHash({ data: "wrong", hash })).resolves.toBe(false);
  });

  it("should assert invalid data", async () => {
    const hash = await _createArgonHash({ data: "data" });

    await expect(_assertArgonHash({ data: "wrong", hash })).rejects.toThrow(ArgonError);
  });
});
