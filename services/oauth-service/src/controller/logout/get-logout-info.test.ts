import MockDate from "mockdate";
import { getLogoutInfoController } from "./get-logout-info";
import { getTestClient, getTestLogoutSession } from "../../test/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getLogoutInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: getTestClient({
          id: "a22d3d6e-61b3-4699-a255-3e87333e3e4a",
        }),
        logoutSession: getTestLogoutSession({
          id: "09e75ed3-751f-44f8-82ac-bc797250a793",
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getLogoutInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
