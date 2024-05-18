import { TEST_OCT_KEY_SIG } from "../../__fixtures__/keys";
import { ArgonError } from "../../errors";
import { _assertArgonHash, _createArgonHash, _verifyArgonHash } from "./argon-hash";

describe("argon-hash", () => {
  it("should resolve", async () => {
    await expect(_createArgonHash({ data: "data" })).resolves.toEqual(
      expect.stringContaining("$argon2id$v=19$m=65536,t=12,p=8$"),
    );
  });

  it("should resolve with secret", async () => {
    await expect(
      _createArgonHash({ data: "data", kryptos: TEST_OCT_KEY_SIG }),
    ).resolves.toEqual(expect.stringContaining("$argon2id$v=19$m=65536,t=12,p=8$"));
  });

  it("should verify data", async () => {
    const hash = await _createArgonHash({ data: "data" });

    await expect(_verifyArgonHash({ data: "data", hash })).resolves.toBe(true);
  });

  it("should verify data with secret", async () => {
    const hash = await _createArgonHash({ data: "data", kryptos: TEST_OCT_KEY_SIG });

    await expect(
      _verifyArgonHash({ data: "data", hash, kryptos: TEST_OCT_KEY_SIG }),
    ).resolves.toBe(true);
  });

  it("should assert data", async () => {
    const hash = await _createArgonHash({ data: "data" });

    await expect(_assertArgonHash({ data: "data", hash })).resolves.not.toThrow();
  });

  it("should assert data with secret", async () => {
    const hash = await _createArgonHash({ data: "data", kryptos: TEST_OCT_KEY_SIG });

    await expect(
      _assertArgonHash({ data: "data", hash, kryptos: TEST_OCT_KEY_SIG }),
    ).resolves.not.toThrow();
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
