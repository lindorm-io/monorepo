import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import type { PylonSignKey } from "../../../types/index.js";
import { resolveCookieSigningKey } from "./resolve-cookie-signing-key.js";

const ISSUER = "http://test.lindorm.io";

const sigKey = (): IKryptos =>
  KryptosKit.generate.sig.oct({
    algorithm: "HS256",
    issuer: ISSUER,
    purpose: "cookie",
    publish: false,
  });

const encKey = (): IKryptos =>
  KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    issuer: ISSUER,
    purpose: "cookie",
    publish: false,
  });

describe("resolveCookieSigningKey", () => {
  let amphora: IAmphora;

  beforeEach(async () => {
    amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
    await amphora.setup();
  });

  test("selects the cookie signing key", async () => {
    const sig = sigKey();
    amphora.add(sig);

    const resolved = await resolveCookieSigningKey(amphora, {
      condition: { purpose: "cookie", publish: false },
    });

    expect(resolved.id).toBe(sig.id);
  });

  // #8: `key.condition` is duck-typed, so a config/JSON one can carry a floor
  // key (`use`). The floor (`use: "sig"`) is applied LAST and wins the merge, so
  // the smuggled `use: "enc"` is overridden — the sig key is selected, never the
  // enc key (which would then fail the post-check floor and throw).
  test("a condition carrying a floor key cannot override the floor", async () => {
    const sig = sigKey();
    const enc = encKey();
    amphora.add(enc);
    amphora.add(sig);

    const resolved = await resolveCookieSigningKey(amphora, {
      condition: { purpose: "cookie", publish: false, use: "enc" },
    } as unknown as PylonSignKey);

    expect(resolved.id).toBe(sig.id);
    expect(resolved.use).toBe("sig");
  });
});
