import { ClientError } from "@lindorm-io/errors";
import { IdentifierType } from "../../common";
import { getTestIdentity } from "../../test/entity";
import { identifierRemoveController } from "./remove";
import { logger } from "../../test/logger";
import {
  removeEmail as _removeEmail,
  removePhoneNumber as _removePhoneNumber,
  removeExternalIdentifier as _removeExternalIdentifier,
} from "../../handler";

jest.mock("../../handler", () => ({
  removeEmail: jest.fn(),
  removePhoneNumber: jest.fn(),
  removeExternalIdentifier: jest.fn(),
}));

const removeEmail = _removeEmail as jest.Mock;
const removePhoneNumber = _removePhoneNumber as jest.Mock;
const removeExternalIdentifier = _removeExternalIdentifier as jest.Mock;

describe("identifierRemoveController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        email: "email",
        identifier: "identifier",
        phoneNumber: "phoneNumber",
        type: "type",
      },
      entity: {
        identity: getTestIdentity({ id: "identityId" }),
      },
      logger,
    };
  });

  test("should resolve for EMAIL", async () => {
    ctx.data.type = IdentifierType.EMAIL;

    await expect(identifierRemoveController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(removeEmail).toHaveBeenCalled();
  });

  test("should resolve for PHONE_NUMBER", async () => {
    ctx.data.type = IdentifierType.PHONE;

    await expect(identifierRemoveController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(removePhoneNumber).toHaveBeenCalled();
  });

  test("should resolve for OIDC", async () => {
    ctx.data.type = IdentifierType.EXTERNAL;

    await expect(identifierRemoveController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(removeExternalIdentifier).toHaveBeenCalled();
  });

  test("should throw on unexpected type", async () => {
    await expect(identifierRemoveController(ctx)).rejects.toThrow(ClientError);
  });
});
