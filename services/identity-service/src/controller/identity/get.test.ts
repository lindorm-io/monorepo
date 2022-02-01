import { Identity } from "../../entity";
import { Scope } from "../../common";
import { getTestIdentity } from "../../test/entity";
import { getUserinfoResponseBody as _getUserinfoResponseBody } from "../../handler";
import { identityGetController } from "./get";

jest.mock("../../handler");

const getUserinfoResponseBody = _getUserinfoResponseBody as jest.Mock;

describe("identityGetController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        identity: getTestIdentity(),
      },
      token: {
        bearerToken: {
          scopes: [Scope.OPENID],
        },
      },
    };

    getUserinfoResponseBody.mockResolvedValue("body");
  });

  test("should resolve", async () => {
    await expect(identityGetController(ctx)).resolves.toStrictEqual({ body: "body" });

    expect(getUserinfoResponseBody).toHaveBeenCalledWith(ctx, expect.any(Identity), [Scope.OPENID]);
  });
});
