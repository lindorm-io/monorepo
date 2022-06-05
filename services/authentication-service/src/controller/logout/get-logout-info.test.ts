import { getLogoutInfoController } from "./get-logout-info";
import { createTestLogoutSession } from "../../fixtures/entity";

describe("getLogoutInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        logoutSession: createTestLogoutSession(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getLogoutInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
