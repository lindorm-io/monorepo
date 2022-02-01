import { ClientError } from "@lindorm-io/errors";
import { IdentifierType } from "../../common";
import { getTestIdentity } from "../../test/entity";
import { identifierSetPrimaryController } from "./set-primary";
import { logger } from "../../test/logger";
import {
  setPrimaryEmail as _setPrimaryEmail,
  setPrimaryPhoneNumber as _setPrimaryPhoneNumber,
} from "../../handler";

jest.mock("../../handler", () => ({
  setPrimaryEmail: jest.fn(),
  setPrimaryPhoneNumber: jest.fn(),
}));

const setPrimaryEmail = _setPrimaryEmail as jest.Mock;
const setPrimaryPhoneNumber = _setPrimaryPhoneNumber as jest.Mock;

describe("identifierSetPrimaryController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        email: "email",
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

    await expect(identifierSetPrimaryController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(setPrimaryEmail).toHaveBeenCalled();
  });

  test("should resolve for PHONE_NUMBER", async () => {
    ctx.data.type = IdentifierType.PHONE;

    await expect(identifierSetPrimaryController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(setPrimaryPhoneNumber).toHaveBeenCalled();
  });

  test("should throw on unexpected type", async () => {
    await expect(identifierSetPrimaryController(ctx)).rejects.toThrow(ClientError);
  });
});
