import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { GrantType } from "../enums/GrantType.js";
import { grantTypeSchema } from "./grant-type.js";

describe("grantTypeSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(Object.values(GrantType).map((v) => grantTypeSchema.parse(v))).toEqual(
      Object.values(GrantType),
    );
  });

  test("should reject a vendor grant type", () => {
    expect(
      grantTypeSchema.safeParse("urn:acme:params:oauth:grant-type:magic"),
    ).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof grantTypeSchema> = GrantType.AuthorizationCode;
    const exported: GrantType = inferred;
    const roundTrip: z.infer<typeof grantTypeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
