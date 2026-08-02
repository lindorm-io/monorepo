import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { PromptMode } from "../enums/PromptMode.js";
import { promptModeSchema } from "./prompt-mode.js";

describe("promptModeSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(Object.values(PromptMode).map((v) => promptModeSchema.parse(v))).toEqual(
      Object.values(PromptMode),
    );
  });

  test("should reject an unlisted value", () => {
    expect(promptModeSchema.safeParse("urn:example:prompt")).toMatchSnapshot();
  });

  test("should reject a space-delimited list — one value per parse", () => {
    expect(promptModeSchema.safeParse("login consent").success).toBe(false);
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof promptModeSchema> = PromptMode.Login;
    const exported: PromptMode = inferred;
    const roundTrip: z.infer<typeof promptModeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
