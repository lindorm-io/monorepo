import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity } from "../../entity";
import { getTestIdentity } from "../../test/entity";
import { verifyNationalIdentityNumber } from "./verify-national-identity-number";

describe("verifyNationalIdentityNumber", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      repository: {
        identityRepository: {
          create: jest.fn().mockImplementation(async (entity) => entity),
          find: jest.fn().mockResolvedValue(
            getTestIdentity({
              id: "583cc391-d983-474e-b078-607c157e4c95",
            }),
          ),
        },
      },
    };
  });

  test("should resolve found identity", async () => {
    await expect(
      verifyNationalIdentityNumber(ctx, {
        nationalIdentityNumber: "nationalIdentityNumber",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).not.toHaveBeenCalled();
  });

  test("should resolve created identity", async () => {
    ctx.repository.identityRepository.find.mockRejectedValue(new EntityNotFoundError("test"));

    await expect(
      verifyNationalIdentityNumber(ctx, {
        nationalIdentityNumber: "nationalIdentityNumber",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).toHaveBeenCalled();
  });

  test("should resolve created identity with specific id", async () => {
    ctx.repository.identityRepository.find.mockRejectedValue(new EntityNotFoundError("test"));

    await expect(
      verifyNationalIdentityNumber(ctx, {
        identityId: "3fa13855-cfd3-468a-8421-e47569f315a0",
        nationalIdentityNumber: "nationalIdentityNumber",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "3fa13855-cfd3-468a-8421-e47569f315a0",
      }),
    );
  });

  test("should throw on invalid identity", async () => {
    await expect(
      verifyNationalIdentityNumber(ctx, {
        identityId: "57c30827-3983-429f-beff-8ac3d81ba396",
        nationalIdentityNumber: "nationalIdentityNumber",
      }),
    ).rejects.toThrow(ClientError);
  });
});
