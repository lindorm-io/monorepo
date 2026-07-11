import { describe, expect, test } from "vitest";
import type { LindormConfig } from "../types/lindorm-config.js";
import { defineConfig } from "./define-config.js";

describe("defineConfig", () => {
  test("returns its input unchanged", () => {
    const config: LindormConfig = {
      db: { sourceDir: "./src/proteus/db" },
    };

    expect(defineConfig(config)).toBe(config);
  });
});
