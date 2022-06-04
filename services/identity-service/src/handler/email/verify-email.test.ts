import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity, Email } from "../../entity";
import { createMockLogger } from "@lindorm-io/winston";
import { getTestIdentity } from "../../test/entity";
import { verifyEmail } from "./verify-email";

describe("verifyEmail", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        emailRepository: {
          create: jest.fn(),
          find: jest.fn().mockResolvedValue(
            new Email({
              identityId: "42d1a64f-1fa9-4466-9a03-572f1232872b",
              email: "email",
              primary: true,
              verified: true,
            }),
          ),
        },
        identityRepository: {
          create: jest.fn().mockImplementation(async (entity) => entity),
          find: jest.fn().mockResolvedValue(
            getTestIdentity({
              id: "42d1a64f-1fa9-4466-9a03-572f1232872b",
            }),
          ),
        },
      },
    };
  });

  test("should resolve identity when found with email", async () => {
    await expect(verifyEmail(ctx, { email: "email" })).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).not.toHaveBeenCalled();
    expect(ctx.repository.emailRepository.create).not.toHaveBeenCalled();
  });

  test("should fallback and resolve new identity and email when entity cannot be found", async () => {
    ctx.repository.emailRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(verifyEmail(ctx, { email: "email" })).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).toHaveBeenCalled();
    expect(ctx.repository.emailRepository.create).toHaveBeenCalled();
  });

  test("should fallback and resolve new identity with specific identityId", async () => {
    ctx.repository.emailRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      verifyEmail(ctx, {
        email: "email",
        identityId: "f7a04192-5a1e-42a5-82af-38b6c28801ec",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "f7a04192-5a1e-42a5-82af-38b6c28801ec",
      }),
    );
    expect(ctx.repository.emailRepository.create).toHaveBeenCalled();
  });

  test("should throw on invalid identity", async () => {
    ctx.repository.emailRepository.find.mockResolvedValue(
      new Email({
        identityId: "5f059922-4fcd-4a32-9bee-9c0fc736303b",
        email: "email",
        primary: true,
        verified: true,
      }),
    );

    await expect(
      verifyEmail(ctx, {
        email: "email",
        identityId: "6882c1d1-9ca7-4672-bc98-228b2c98b1df",
      }),
    ).rejects.toThrow(ClientError);
  });
});
