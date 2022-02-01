import { ExternalIdentifier } from "../../entity";
import { userinfoExternalIdentifierAdd } from "./userinfo-external-identifier-add";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { logger } from "../../test/logger";

describe("userinfoExternalIdentifierAdd", () => {
  const identifier1 = new ExternalIdentifier({
    identityId: "identityId",
    identifier: "identifier1",
    provider: "provider1",
  });

  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      logger,
      repository: {
        externalIdentifierRepository: {
          create: jest.fn().mockImplementation(async (entity: any) => entity),
          find: jest.fn().mockResolvedValue(identifier1),
        },
      },
    };
    options = {
      identityId: "identityId",
      identifier: "identifier",
      provider: "provider",
    };
  });

  test("should resolve with found identifier", async () => {
    await expect(userinfoExternalIdentifierAdd(ctx, options)).resolves.toStrictEqual(identifier1);
  });

  test("should resolve with new identifier", async () => {
    ctx.repository.externalIdentifierRepository.find.mockRejectedValue(
      new EntityNotFoundError("message"),
    );

    await expect(userinfoExternalIdentifierAdd(ctx, options)).resolves.toStrictEqual(
      expect.objectContaining({
        identityId: "identityId",
        identifier: "identifier",
        provider: "provider",
      }),
    );
  });
});
