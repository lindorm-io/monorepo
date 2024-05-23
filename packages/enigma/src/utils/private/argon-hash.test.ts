import { TEST_OCT_KEY_SIG } from "../../__fixtures__/keys";
import { ArgonError } from "../../errors";
import { assertArgonHash, createArgonHash, verifyArgonHash } from "./argon-hash";

describe("argon-hash", () => {
  it("should resolve", async () => {
    await expect(createArgonHash({ data: "data" })).resolves.toEqual(
      expect.stringContaining("$argon2id$v=19$m=65536,t=12,p=8$"),
    );
  });

  it("should resolve with secret", async () => {
    await expect(
      createArgonHash({ data: "data", kryptos: TEST_OCT_KEY_SIG }),
    ).resolves.toEqual(expect.stringContaining("$argon2id$v=19$m=65536,t=12,p=8$"));
  });

  it("should verify data", async () => {
    const hash = await createArgonHash({ data: "data" });

    await expect(verifyArgonHash({ data: "data", hash })).resolves.toBe(true);
  });

  it("should verify data with secret", async () => {
    const hash = await createArgonHash({ data: "data", kryptos: TEST_OCT_KEY_SIG });

    await expect(
      verifyArgonHash({ data: "data", hash, kryptos: TEST_OCT_KEY_SIG }),
    ).resolves.toBe(true);
  });

  it("should assert data", async () => {
    const hash = await createArgonHash({ data: "data" });

    await expect(assertArgonHash({ data: "data", hash })).resolves.toBeUndefined();
  });

  it("should assert data with secret", async () => {
    const hash = await createArgonHash({ data: "data", kryptos: TEST_OCT_KEY_SIG });

    await expect(
      assertArgonHash({ data: "data", hash, kryptos: TEST_OCT_KEY_SIG }),
    ).resolves.toBeUndefined();
  });

  it("should verify invalid data", async () => {
    const hash = await createArgonHash({ data: "data" });

    await expect(verifyArgonHash({ data: "wrong", hash })).resolves.toBe(false);
  });

  it("should assert invalid data", async () => {
    const hash = await createArgonHash({ data: "data" });

    await expect(assertArgonHash({ data: "wrong", hash })).rejects.toThrow(ArgonError);
  });
});
