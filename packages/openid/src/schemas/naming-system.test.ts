import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { NamingSystem } from "../enums/NamingSystem.js";
import { namingSystemSchema } from "./naming-system.js";

describe("namingSystemSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(Object.values(NamingSystem).map((v) => namingSystemSchema.parse(v))).toEqual(
      Object.values(NamingSystem),
    );
  });

  test("should reject an unlisted value", () => {
    expect(namingSystemSchema.safeParse("family_only")).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof namingSystemSchema> = NamingSystem.GivenFamily;
    const exported: NamingSystem = inferred;
    const roundTrip: z.infer<typeof namingSystemSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
