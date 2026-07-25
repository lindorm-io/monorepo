import { ServerError } from "@lindorm/errors";
import { getOpenIdConfiguration } from "./get-open-id-configuration.js";
import { beforeEach, describe, expect, test } from "vitest";

describe("getOpenIdConfiguration", () => {
  let config: any;
  let ctx: any;

  beforeEach(() => {
    config = {
      issuer: "issuer",
    };

    ctx = {
      amphora: {
        idp: {
          config: () => ({
            issuer: "issuer",
            openIdConfiguration: { issuer: "issuer", test: "test" },
          }),
        },
      },
    };
  });

  test("should resolve", () => {
    expect(getOpenIdConfiguration(ctx, config)).toEqual({
      issuer: "issuer",
      test: "test",
    });
  });

  test("should throw error if configuration cannot be found", () => {
    config.issuer = "wrong";

    expect(() => getOpenIdConfiguration(ctx, config)).toThrow(ServerError);
  });

  test("propagates the throw when no idp is configured", () => {
    ctx.amphora.idp.config = () => {
      throw new Error("idp_not_configured");
    };

    expect(() => getOpenIdConfiguration(ctx, config)).toThrow();
  });
});
