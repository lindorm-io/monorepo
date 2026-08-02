import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { DisplayMode } from "../enums/DisplayMode.js";
import { displayModeSchema } from "./display-mode.js";

describe("displayModeSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(Object.values(DisplayMode).map((v) => displayModeSchema.parse(v))).toEqual(
      Object.values(DisplayMode),
    );
  });

  test("should reject an unlisted value", () => {
    expect(displayModeSchema.safeParse("kiosk")).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof displayModeSchema> = DisplayMode.Page;
    const exported: DisplayMode = inferred;
    const roundTrip: z.infer<typeof displayModeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
