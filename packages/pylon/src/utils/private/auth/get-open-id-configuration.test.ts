import { ServerError } from "@lindorm/errors";
import { getOpenIdConfiguration } from "./get-open-id-configuration";

describe("getOpenIdConfiguration", () => {
  let config: any;
  let ctx: any;

  beforeEach(() => {
    config = {
      issuer: "issuer",
    };

    ctx = {
      amphora: {
        config: [
          { issuer: "issuer", test: "test" },
          { issuer: "other", test: "other" },
        ],
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
});
