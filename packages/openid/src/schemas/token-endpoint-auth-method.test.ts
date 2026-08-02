import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { TokenEndpointAuthMethod } from "../enums/TokenEndpointAuthMethod.js";
import { tokenEndpointAuthMethodSchema } from "./token-endpoint-auth-method.js";

describe("tokenEndpointAuthMethodSchema", () => {
  test("should accept every value the enum carries", () => {
    expect(
      Object.values(TokenEndpointAuthMethod).map((v) =>
        tokenEndpointAuthMethodSchema.parse(v),
      ),
    ).toEqual(Object.values(TokenEndpointAuthMethod));
  });

  test("should reject an unregistered method", () => {
    expect(
      tokenEndpointAuthMethodSchema.safeParse("urn:example:auth-method"),
    ).toMatchSnapshot();
  });

  test("should infer exactly the exported type", () => {
    const inferred: z.infer<typeof tokenEndpointAuthMethodSchema> =
      TokenEndpointAuthMethod.PrivateKeyJwt;
    const exported: TokenEndpointAuthMethod = inferred;
    const roundTrip: z.infer<typeof tokenEndpointAuthMethodSchema> = exported;

    expect([inferred, exported, roundTrip]).toMatchSnapshot();
  });
});
