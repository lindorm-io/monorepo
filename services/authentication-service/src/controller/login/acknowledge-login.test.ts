import MockDate from "mockdate";
import { acknowledgeLoginController } from "./acknowledge-login";
import { createTestLoginSession } from "../../fixtures/entity";
import { createMockCache } from "@lindorm-io/redis";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("acknowledgeLoginController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: createMockCache(createTestLoginSession),
      },
      entity: {
        loginSession: createTestLoginSession({
          authenticationSessionId: "333c59d9-22f8-4165-9b72-7065495c609a",
          codeVerifier: "V7XirRnXhmIeWmzT5BOx8RERym3bzSW6",
          expires: new Date("2022-01-01T08:30:00.000Z"),
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(acknowledgeLoginController(ctx)).resolves.toMatchSnapshot();

    expect(ctx.cache.loginSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "acknowledged",
      }),
    );
  });
});
