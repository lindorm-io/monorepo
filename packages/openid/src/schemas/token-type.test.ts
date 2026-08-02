import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { TokenType } from "../enums/TokenType.js";
import { tokenTypeSchema } from "./token-type.js";

describe("tokenTypeSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(Object.values(TokenType).map((v) => tokenTypeSchema.parse(v))).toEqual(
      Object.values(TokenType),
    );
  });

  test("should reject an unlisted value", () => {
    expect(tokenTypeSchema.safeParse("mac")).toMatchSnapshot();
  });

  test("should reject a case variant of a listed value", () => {
    expect(tokenTypeSchema.safeParse("bearer")).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof tokenTypeSchema> = TokenType.DPoP;
    const exported: TokenType = inferred;
    const roundTrip: z.infer<typeof tokenTypeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
