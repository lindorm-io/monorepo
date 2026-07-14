import { describe, expect, test } from "vitest";
import { KryptosKit } from "./KryptosKit.js";

describe("KryptosKit.clone", () => {
  // The DER export re-emits id/algorithm/curve/type/use, and it used to be
  // spread AFTER `overwrite` — so every one of these was silently discarded and
  // the clone came back as a copy of the original. Fixtures declaring an id got
  // the original's id instead, and nothing noticed.
  test("honours the overwrite instead of silently discarding it", () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });

    const clone = KryptosKit.clone(key, {
      id: "3f6c1c62-0000-4000-8000-000000000001",
      issuer: "https://clone.test/",
      purpose: "clone",
      publish: true,
    });

    expect(clone.id).toBe("3f6c1c62-0000-4000-8000-000000000001");
    expect(clone.issuer).toBe("https://clone.test/");
    expect(clone.purpose).toBe("clone");
    expect(clone.publish).toBe(true);
    expect(key.id).not.toBe(clone.id);
  });

  test("carries the key material over verbatim", () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });
    const clone = KryptosKit.clone(key, { id: "3f6c1c62-0000-4000-8000-000000000002" });

    expect(clone.export("b64")).toEqual({
      ...key.export("b64"),
      id: "3f6c1c62-0000-4000-8000-000000000002",
    });
  });
});
