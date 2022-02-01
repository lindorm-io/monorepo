import { userinfoController } from "./userinfo";
import { TEST_GET_USERINFO_RESPONSE } from "../../test/data";
import { getIdentityUserinfo as _getIdentityUserinfo } from "../../handler";

jest.mock("../../handler");

const getIdentityUserinfo = _getIdentityUserinfo as jest.Mock;

describe("userinfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      token: {
        bearerToken: {
          subject: "subject",
          scopes: ["scope"],
        },
      },
    };

    getIdentityUserinfo.mockResolvedValue(TEST_GET_USERINFO_RESPONSE);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve user info", async () => {
    await expect(userinfoController(ctx)).resolves.toMatchSnapshot();
  });
});
