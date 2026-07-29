import { describe, expect, it } from "vitest";
import { TEST_KEY_ENV_KEK } from "../internal/__fixtures__/keys.js";
import { Encrypted } from "./Encrypted.js";

describe("Encrypted", () => {
  it("should stage an empty descriptor, which the source then refuses to load", () => {
    @Encrypted()
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.encrypted).toMatchSnapshot();
  });

  it("should stage a condition", () => {
    @Encrypted({ condition: { purpose: "pii" } })
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.encrypted).toMatchSnapshot();
  });

  it("should stage an injected kryptos", () => {
    @Encrypted({ kryptos: TEST_KEY_ENV_KEK })
    class TestMsg {}

    const meta = (TestMsg as any)[Symbol.metadata];
    expect(meta.encrypted.kryptos.id).toBe(TEST_KEY_ENV_KEK.id);
  });
});
