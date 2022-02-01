import { ExternalIdentifier } from "../../entity";
import { removeExternalIdentifier } from "./remove-external-identifier";
import { logger } from "../../test/logger";

describe("removeExternalIdentifier", () => {
  const identifier1 = new ExternalIdentifier({
    identityId: "identityId",
    identifier: "identifier",
    provider: "provider",
  });

  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      logger,
      repository: {
        externalIdentifierRepository: {
          find: jest.fn().mockResolvedValue(identifier1),
          destroy: jest.fn(),
        },
      },
    };
    options = {
      identityId: "identityId",
      identifier: "identifier",
    };
  });

  test("should find and remove identifier", async () => {
    await expect(removeExternalIdentifier(ctx, options)).resolves.toBeUndefined();

    expect(ctx.repository.externalIdentifierRepository.destroy).toHaveBeenCalledWith(identifier1);
  });
});
