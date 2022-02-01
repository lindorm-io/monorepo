import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity, ExternalIdentifier } from "../../entity";
import { logger } from "../../test/logger";
import { verifyExternalIdentifier } from "./verify-external-identifier";

describe("verifyExternalIdentifier", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger,
      repository: {
        identityRepository: {
          create: jest.fn().mockResolvedValue(
            new Identity({
              id: "a975fa92-3183-4d83-9181-a89a21536b0f",
            }),
          ),
          find: jest.fn().mockResolvedValue(new Identity({})),
        },
        externalIdentifierRepository: {
          create: jest.fn(),
          find: jest.fn().mockResolvedValue(
            new ExternalIdentifier({
              identityId: "a975fa92-3183-4d83-9181-a89a21536b0f",
              identifier: "identifier",
              provider: "provider",
            }),
          ),
        },
      },
    };
  });

  test("should resolve identity when found with identifier", async () => {
    await expect(
      verifyExternalIdentifier(ctx, {
        identifier: "identifier",
        provider: "provider",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).not.toHaveBeenCalled();
    expect(ctx.repository.externalIdentifierRepository.create).not.toHaveBeenCalled();
  });

  test("should fallback and resolve new identity and identifier when entity cannot be found", async () => {
    ctx.repository.externalIdentifierRepository.find.mockRejectedValue(
      new EntityNotFoundError("message"),
    );

    await expect(
      verifyExternalIdentifier(ctx, {
        identifier: "identifier",
        provider: "provider",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).toHaveBeenCalled();
    expect(ctx.repository.externalIdentifierRepository.create).toHaveBeenCalled();
  });

  test("should fallback and resolve new identity with specific identityId", async () => {
    ctx.repository.externalIdentifierRepository.find.mockRejectedValue(
      new EntityNotFoundError("message"),
    );

    await expect(
      verifyExternalIdentifier(ctx, {
        identifier: "identifier",
        identityId: "f7a04192-5a1e-42a5-82af-38b6c28801ec",
        provider: "provider",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "f7a04192-5a1e-42a5-82af-38b6c28801ec",
      }),
    );
    expect(ctx.repository.externalIdentifierRepository.create).toHaveBeenCalled();
  });

  test("should throw on invalid identity", async () => {
    ctx.repository.externalIdentifierRepository.find.mockResolvedValue(
      new ExternalIdentifier({
        identityId: "a975fa92-3183-4d83-9181-a89a21536b0f",
        identifier: "identifier",
        provider: "provider",
      }),
    );

    await expect(
      verifyExternalIdentifier(ctx, {
        identifier: "identifier",
        identityId: "6882c1d1-9ca7-4672-bc98-228b2c98b1df",
        provider: "provider",
      }),
    ).rejects.toThrow(ClientError);
  });
});
