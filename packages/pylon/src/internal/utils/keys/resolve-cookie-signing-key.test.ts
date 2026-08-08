import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import type { PylonSignKey } from "../../../types/index.js";
import { resolveCookieSigningKey } from "./resolve-cookie-signing-key.js";

const ISSUER = "http://test.lindorm.io";

const OLDER = new Date("2024-01-01T00:00:00.000Z");
const NEWER = new Date("2024-06-01T00:00:00.000Z");

const sigKey = (): IKryptos =>
  KryptosKit.generate.sig.oct({
    algorithm: "HS256",
    createdAt: OLDER,
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
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger: createMockLogger() });
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

  // A cookie signature is verified by this deployment alone, so a selector that
  // names no `publish` means `publish: false` — otherwise amphora's gate hides
  // the very key the condition describes and the deployment has to spell the
  // default out by hand. The NEWER published cookie key is the control: `find`
  // returns the newest match, so it is what an ungated query would hand back.
  test("resolves an internal unpublished key for a condition that names no publish", async () => {
    const internal = sigKey();
    const published = KryptosKit.generate.sig.oct({
      algorithm: "HS256",
      createdAt: NEWER,
      issuer: ISSUER,
      publish: true,
      purpose: "cookie",
    });

    amphora.add([internal, published]);

    const resolved = await resolveCookieSigningKey(amphora, {
      condition: { purpose: "cookie" },
    });

    expect(resolved.id).toBe(internal.id);
    expect(resolved.publish).toBe(false);
  });

  // The default is a default: it loses to the caller, unlike the floor. A
  // deployment that deliberately signs cookies with a published key still can.
  test("a condition stating publish: true overrides the default", async () => {
    const published = KryptosKit.generate.sig.oct({
      algorithm: "HS256",
      createdAt: OLDER,
      issuer: ISSUER,
      publish: true,
      purpose: "cookie",
    });

    amphora.add([sigKey(), published]);

    const resolved = await resolveCookieSigningKey(amphora, {
      condition: { purpose: "cookie", publish: true },
    });

    expect(resolved.id).toBe(published.id);
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
