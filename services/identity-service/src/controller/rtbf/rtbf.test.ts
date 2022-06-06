import { createTestIdentity } from "../../fixtures/entity";
import { removeIdentityDisplayName as _removeIdentityDisplayName } from "../../handler";
import { rtbfController } from "./rtbf";
import { createMockRepository } from "@lindorm-io/mongo";

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
        identifierRepository: createMockRepository(),
        identityRepository: createMockRepository(),
      },
    };

    removeIdentityDisplayName.mockImplementation(async () => {});
  });

  test("should resolve", async () => {
    await expect(rtbfController(ctx)).resolves.toBeUndefined();

    expect(removeIdentityDisplayName).toHaveBeenCalled();
    expect(ctx.repository.identifierRepository.deleteMany).toHaveBeenCalled();
    expect(ctx.repository.identityRepository.destroy).toHaveBeenCalled();
  });
});
