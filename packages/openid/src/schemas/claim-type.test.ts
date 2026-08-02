import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { ClaimType } from "../enums/ClaimType.js";
import { claimTypeSchema } from "./claim-type.js";

describe("claimTypeSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(Object.values(ClaimType).map((v) => claimTypeSchema.parse(v))).toEqual(
      Object.values(ClaimType),
    );
  });

  test("should reject an unlisted value", () => {
    expect(claimTypeSchema.safeParse("urn:example:claim-type")).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof claimTypeSchema> = ClaimType.Normal;
    const exported: ClaimType = inferred;
    const roundTrip: z.infer<typeof claimTypeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
