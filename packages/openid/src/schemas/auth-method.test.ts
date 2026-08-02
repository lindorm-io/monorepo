import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { AuthMethod } from "../enums/AuthMethod.js";
import { authMethodSchema } from "./auth-method.js";

describe("authMethodSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(Object.values(AuthMethod).map((v) => authMethodSchema.parse(v))).toEqual(
      Object.values(AuthMethod),
    );
  });

  test("should reject an unlisted value", () => {
    expect(authMethodSchema.safeParse("urn:example:amr")).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof authMethodSchema> = AuthMethod.Password;
    const exported: AuthMethod = inferred;
    const roundTrip: z.infer<typeof authMethodSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
