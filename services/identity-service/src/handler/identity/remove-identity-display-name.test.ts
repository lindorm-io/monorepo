import { getTestDisplayName, getTestIdentity } from "../../test/entity";
import { logger } from "../../test/logger";
import { removeIdentityDisplayName } from "./remove-identity-display-name";

describe("removeIdentityDisplayName", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger,
      repository: {
        displayNameRepository: {
          find: jest.fn().mockResolvedValue(
            getTestDisplayName({
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
        getTestIdentity({
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
