import { getTestIdentity } from "../../test/entity";
import { identityRemoveController } from "./remove";
import { logger } from "../../test/logger";
import { removeIdentityDisplayName as _removeIdentityDisplayName } from "../../handler";

jest.mock("../../handler", () => ({
  removeIdentityDisplayName: jest.fn().mockImplementation(async () => {}),
}));

const removeIdentityDisplayName = _removeIdentityDisplayName as jest.Mock;

describe("identityRemoveController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        identity: getTestIdentity({
          id: "identityId",
          displayName: {
            name: "name",
            number: 1234,
          },
        }),
      },
      logger,
      repository: {
        emailRepository: {
          destroyMany: jest.fn(),
        },
        identityRepository: {
          destroy: jest.fn(),
        },
        externalIdentifierRepository: {
          destroyMany: jest.fn(),
        },
        phoneNumberRepository: {
          destroyMany: jest.fn(),
        },
      },
      token: {
        bearerToken: {
          subject: "identityId",
        },
      },
    };
  });

  test("should remove identity", async () => {
    await expect(identityRemoveController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(removeIdentityDisplayName).toHaveBeenCalled();
    expect(ctx.repository.emailRepository.destroyMany).toHaveBeenCalled();
    expect(ctx.repository.externalIdentifierRepository.destroyMany).toHaveBeenCalled();
    expect(ctx.repository.phoneNumberRepository.destroyMany).toHaveBeenCalled();
    expect(ctx.repository.identityRepository.destroy).toHaveBeenCalled();
  });
});
