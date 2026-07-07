import { join } from "path";
import type { PylonHttpContext } from "../../../types/index.js";
import { selectStaticVariant } from "./select-static-variant.js";
import { describe, expect, test } from "vitest";

const assets = join(__dirname, "..", "..", "..", "__fixtures__", "static-assets");
const sample = join(assets, "sample.txt"); // has .br and .gz siblings
const image = join(assets, "image.jpg"); // no precompressed siblings

// Minimal ctx exposing only the negotiation surface the util reads.
const ctx = (accepted: Array<string>): PylonHttpContext =>
  ({
    acceptsEncodings: (...encodings: Array<string>) =>
      encodings.find((e) => accepted.includes(e)) ?? false,
  }) as unknown as PylonHttpContext;

describe("selectStaticVariant", () => {
  test("identity when precompressed is disabled, even if br is accepted", async () => {
    expect(await selectStaticVariant(ctx(["br", "gzip"]), sample, false)).toEqual({
      path: sample,
      encoding: null,
    });
  });

  test("prefers the brotli sibling when accepted and present", async () => {
    expect(await selectStaticVariant(ctx(["br", "gzip"]), sample, true)).toEqual({
      path: sample + ".br",
      encoding: "br",
    });
  });

  test("falls back to gzip when brotli is not accepted", async () => {
    expect(await selectStaticVariant(ctx(["gzip"]), sample, true)).toEqual({
      path: sample + ".gz",
      encoding: "gzip",
    });
  });

  test("identity when the client accepts no compressed encoding", async () => {
    expect(await selectStaticVariant(ctx(["identity"]), sample, true)).toEqual({
      path: sample,
      encoding: null,
    });
  });

  test("identity when a sibling does not exist on disk", async () => {
    expect(await selectStaticVariant(ctx(["br", "gzip"]), image, true)).toEqual({
      path: image,
      encoding: null,
    });
  });
});
