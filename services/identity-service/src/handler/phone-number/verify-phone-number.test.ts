import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity, PhoneNumber } from "../../entity";
import { verifyPhoneNumber } from "./verify-phone-number";
import { logger } from "../../test/logger";
import { ClientError } from "@lindorm-io/errors";

describe("verifyPhoneNumber", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger,
      repository: {
        phoneNumberRepository: {
          create: jest.fn(),
          find: jest.fn().mockResolvedValue(
            new PhoneNumber({
              identityId: "identityId",
              phoneNumber: "phoneNumber",
              primary: true,
              verified: true,
            }),
          ),
        },
        identityRepository: {
          create: jest.fn().mockResolvedValue(
            new Identity({
              id: "identityId",
            }),
          ),
          find: jest.fn().mockResolvedValue(new Identity({})),
        },
      },
    };
  });

  test("should resolve identity when found with phone number", async () => {
    await expect(verifyPhoneNumber(ctx, { phoneNumber: "phoneNumber" })).resolves.toStrictEqual(
      expect.any(Identity),
    );

    expect(ctx.repository.identityRepository.create).not.toHaveBeenCalled();
    expect(ctx.repository.phoneNumberRepository.create).not.toHaveBeenCalled();
  });

  test("should fallback and resolve new identity and phone number when entity cannot be found", async () => {
    ctx.repository.phoneNumberRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(verifyPhoneNumber(ctx, { phoneNumber: "phoneNumber" })).resolves.toStrictEqual(
      expect.any(Identity),
    );

    expect(ctx.repository.identityRepository.create).toHaveBeenCalled();
    expect(ctx.repository.phoneNumberRepository.create).toHaveBeenCalled();
  });

  test("should fallback and resolve new identity with specific identityId", async () => {
    ctx.repository.phoneNumberRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      verifyPhoneNumber(ctx, {
        phoneNumber: "phoneNumber",
        identityId: "f7a04192-5a1e-42a5-82af-38b6c28801ec",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "f7a04192-5a1e-42a5-82af-38b6c28801ec",
      }),
    );
    expect(ctx.repository.phoneNumberRepository.create).toHaveBeenCalled();
  });

  test("should throw on invalid identity", async () => {
    ctx.repository.phoneNumberRepository.find.mockResolvedValue(
      new PhoneNumber({
        identityId: "5f059922-4fcd-4a32-9bee-9c0fc736303b",
        phoneNumber: "phoneNumber",
        primary: true,
        verified: true,
      }),
    );

    await expect(
      verifyPhoneNumber(ctx, {
        phoneNumber: "phoneNumber",
        identityId: "6882c1d1-9ca7-4672-bc98-228b2c98b1df",
      }),
    ).rejects.toThrow(ClientError);
  });
});
