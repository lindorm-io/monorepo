import { Identity } from "../../entity";
import { Scope } from "../../common";
import { createTestIdentity } from "../../fixtures/entity";
import { getUserinfoController } from "./get-userinfo";
import { getUserinfoResponseBody as _getUserinfoResponseBody } from "../../handler";

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
        identity: createTestIdentity(),
      },
    };

    getUserinfoResponseBody.mockResolvedValue("getUserinfoResponseBody");
  });

  test("should resolve with basic userinfo", async () => {
    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
      body: "getUserinfoResponseBody",
    });

    expect(getUserinfoResponseBody).toHaveBeenCalledWith(ctx, expect.any(Identity), [
      Scope.OPENID,
      Scope.EMAIL,
    ]);
  });
});
