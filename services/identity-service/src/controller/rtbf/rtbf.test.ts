import { createTestIdentity } from "../../fixtures/entity";
import { removeIdentityDisplayName as _removeIdentityDisplayName } from "../../handler";
import { rtbfController } from "./rtbf";

jest.mock("../../handler");

const removeIdentityDisplayName = _removeIdentityDisplayName as jest.Mock;

describe("rtbfController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        identity: createTestIdentity({
          displayName: {
            name: "name",
            number: 1234,
          },
        }),
      },
      repository: {
        emailRepository: {
          deleteMany: jest.fn(),
        },
        identityRepository: {
          destroy: jest.fn(),
        },
        externalIdentifierRepository: {
          deleteMany: jest.fn(),
        },
        phoneNumberRepository: {
          deleteMany: jest.fn(),
        },
      },
    };

    removeIdentityDisplayName.mockImplementation(async () => {});
  });

  test("should resolve", async () => {
    await expect(rtbfController(ctx)).resolves.toBeUndefined();

    expect(removeIdentityDisplayName).toHaveBeenCalled();
    expect(ctx.repository.emailRepository.deleteMany).toHaveBeenCalled();
    expect(ctx.repository.externalIdentifierRepository.deleteMany).toHaveBeenCalled();
    expect(ctx.repository.phoneNumberRepository.deleteMany).toHaveBeenCalled();
    expect(ctx.repository.identityRepository.destroy).toHaveBeenCalled();
  });
});
