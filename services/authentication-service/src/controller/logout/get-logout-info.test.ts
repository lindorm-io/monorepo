import { getLogoutInfoController } from "./get-logout-info";
import { getTestLogoutSession } from "../../test/entity";

describe("getLogoutInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        logoutSession: getTestLogoutSession(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getLogoutInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
