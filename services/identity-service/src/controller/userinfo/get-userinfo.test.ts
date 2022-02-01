import { Identity } from "../../entity";
import { Scope } from "../../common";
import { getTestIdentity } from "../../test/entity";
import { getUserinfoResponseBody as _getUserinfoResponseBody } from "../../handler";
import { getUserinfoController } from "./get-userinfo";

jest.mock("../../handler");

const getUserinfoResponseBody = _getUserinfoResponseBody as jest.Mock;

describe("getUserinfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        scope: [Scope.OPENID, Scope.EMAIL].join(" "),
      },
      entity: {
        identity: getTestIdentity(),
      },
    };

    getUserinfoResponseBody.mockResolvedValue("body");
  });

  test("should resolve with basic userinfo", async () => {
    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();

    expect(getUserinfoResponseBody).toHaveBeenCalledWith(ctx, expect.any(Identity), [
      Scope.OPENID,
      Scope.EMAIL,
    ]);
  });
});
