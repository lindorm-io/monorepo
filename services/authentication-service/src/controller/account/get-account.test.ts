import { getAccountController } from "./get-account";
import { createTestAccount } from "../../fixtures/entity";

describe("getAccountController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        account: createTestAccount(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getAccountController(ctx)).resolves.toStrictEqual({
      body: {
        browserLinkCode: true,
        password: true,
        recoveryCode: true,
        totp: true,
      },
    });
  });
});
