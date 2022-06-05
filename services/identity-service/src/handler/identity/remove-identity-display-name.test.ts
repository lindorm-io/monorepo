import { createMockLogger } from "@lindorm-io/winston";
import { createTestDisplayName, createTestIdentity } from "../../fixtures/entity";
import { removeIdentityDisplayName } from "./remove-identity-display-name";

describe("removeIdentityDisplayName", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        displayNameRepository: {
          find: jest.fn().mockResolvedValue(
            createTestDisplayName({
              name: "displayName",
              numbers: [1234],
            }),
          ),
          update: jest.fn(),
        },
      },
    };
  });

  test("should remove number from displayName entity", async () => {
    await expect(
      removeIdentityDisplayName(
        ctx,
        createTestIdentity({
          displayName: {
            name: "displayName",
            number: 1234,
          },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(ctx.repository.displayNameRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "displayName",
        numbers: [],
      }),
    );
  });
});
