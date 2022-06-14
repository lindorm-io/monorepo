import MockDate from "mockdate";
import { createTestLoginSession } from "../../fixtures/entity";
import { getLoginInfoController } from "./get-login-info";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("acknowledgeLoginController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
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
    await expect(getLoginInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
