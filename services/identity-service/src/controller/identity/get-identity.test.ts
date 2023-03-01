import { createTestIdentity } from "../../fixtures/entity";
import { getIdentityController } from "./get-identity";
import { getIdentityResponse as _getIdentityResponse } from "../../handler";

jest.mock("../../handler");

const getIdentityResponse = _getIdentityResponse as jest.Mock;

describe("getIdentityController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        identity: createTestIdentity(),
      },
    };

    getIdentityResponse.mockResolvedValue("getIdentityResponse");
  });

  test("should resolve", async () => {
    await expect(getIdentityController(ctx)).resolves.toStrictEqual({
      body: "getIdentityResponse",
    });
  });
});
