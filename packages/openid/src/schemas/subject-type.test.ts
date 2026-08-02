import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { SubjectType } from "../enums/SubjectType.js";
import { subjectTypeSchema } from "./subject-type.js";

describe("subjectTypeSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(Object.values(SubjectType).map((v) => subjectTypeSchema.parse(v))).toEqual(
      Object.values(SubjectType),
    );
  });

  test("should reject an unlisted value", () => {
    expect(subjectTypeSchema.safeParse("identity")).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof subjectTypeSchema> = SubjectType.Public;
    const exported: SubjectType = inferred;
    const roundTrip: z.infer<typeof subjectTypeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
