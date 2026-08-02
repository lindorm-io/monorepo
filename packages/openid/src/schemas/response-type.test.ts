import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { ResponseType } from "../enums/ResponseType.js";
import { responseTypeSchema } from "./response-type.js";

describe("responseTypeSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(Object.values(ResponseType).map((v) => responseTypeSchema.parse(v))).toEqual(
      Object.values(ResponseType),
    );
  });

  test("should reject an unlisted value", () => {
    expect(responseTypeSchema.safeParse("urn:example:response-type")).toMatchSnapshot();
  });

  test("should reject a re-ordered multi-value response type", () => {
    expect(responseTypeSchema.safeParse("id_token code").success).toBe(false);
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof responseTypeSchema> = ResponseType.Code;
    const exported: ResponseType = inferred;
    const roundTrip: z.infer<typeof responseTypeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
