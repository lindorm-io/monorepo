import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { ResponseMode } from "../enums/ResponseMode.js";
import { responseModeSchema } from "./response-mode.js";

describe("responseModeSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(Object.values(ResponseMode).map((v) => responseModeSchema.parse(v))).toEqual(
      Object.values(ResponseMode),
    );
  });

  test("should reject an unregistered mode", () => {
    expect(responseModeSchema.safeParse("web_message")).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof responseModeSchema> = ResponseMode.Query;
    const exported: ResponseMode = inferred;
    const roundTrip: z.infer<typeof responseModeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
