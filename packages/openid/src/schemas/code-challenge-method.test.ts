import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { CodeChallengeMethod } from "../enums/CodeChallengeMethod.js";
import { codeChallengeMethodSchema } from "./code-challenge-method.js";

describe("codeChallengeMethodSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(
      Object.values(CodeChallengeMethod).map((v) => codeChallengeMethodSchema.parse(v)),
    ).toEqual(Object.values(CodeChallengeMethod));
  });

  test("should reject an unlisted value", () => {
    expect(codeChallengeMethodSchema.safeParse("S512")).toMatchSnapshot();
  });

  test("should reject the wrong casing of a listed value", () => {
    expect(codeChallengeMethodSchema.safeParse("s256").success).toBe(false);
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof codeChallengeMethodSchema> = CodeChallengeMethod.S256;
    const exported: CodeChallengeMethod = inferred;
    const roundTrip: z.infer<typeof codeChallengeMethodSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
