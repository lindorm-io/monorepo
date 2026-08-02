import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { LindormScope, Scope, StandardScope } from "../enums/Scope.js";
import { lindormScopeSchema, scopeSchema, standardScopeSchema } from "./scope.js";

describe("scopeSchema", () => {
  test("should accept every value the composed enum carries", () => {
    expect(Object.values(Scope).map((v) => scopeSchema.parse(v))).toEqual(
      Object.values(Scope),
    );
  });

  test("should reject a deployment-defined scope", () => {
    expect(scopeSchema.safeParse("urn:acme:scope")).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof scopeSchema> = Scope.OpenId;
    const exported: Scope = inferred;
    const roundTrip: z.infer<typeof scopeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});

describe("lindormScopeSchema", () => {
  test("should accept every lindorm extension scope", () => {
    expect(Object.values(LindormScope).map((v) => lindormScopeSchema.parse(v))).toEqual(
      Object.values(LindormScope),
    );
  });

  test("should reject a standard scope", () => {
    expect(lindormScopeSchema.safeParse(StandardScope.OpenId).success).toBe(false);
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof lindormScopeSchema> = LindormScope.WorkProfile;
    const exported: LindormScope = inferred;
    const roundTrip: z.infer<typeof lindormScopeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});

describe("standardScopeSchema", () => {
  test("should accept every standard scope", () => {
    expect(Object.values(StandardScope).map((v) => standardScopeSchema.parse(v))).toEqual(
      Object.values(StandardScope),
    );
  });

  test("should reject a lindorm extension scope", () => {
    expect(standardScopeSchema.safeParse(LindormScope.WorkProfile).success).toBe(false);
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof standardScopeSchema> = StandardScope.OfflineAccess;
    const exported: StandardScope = inferred;
    const roundTrip: z.infer<typeof standardScopeSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
