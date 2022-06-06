import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity } from "../../entity";
import { authenticateNationalIdentityNumber } from "./authenticate-national-identity-number";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestIdentity } from "../../fixtures/entity";

describe("authenticateNationalIdentityNumber", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      repository: {
        identityRepository: createMockRepository(createTestIdentity),
      },
    };
  });

  test("should resolve found identity", async () => {
    await expect(
      authenticateNationalIdentityNumber(ctx, {
        nationalIdentityNumber: "202202050101",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));
  });

  test("should resolve found and verified identity", async () => {
    ctx.repository.identityRepository.find.mockResolvedValue(
      createTestIdentity({
        id: "identityId",
      }),
    );

    await expect(
      authenticateNationalIdentityNumber(ctx, {
        identityId: "identityId",
        nationalIdentityNumber: "202202050101",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));
  });

  test("should resolve found and set national identity number as verified", async () => {
    ctx.repository.identityRepository.find.mockResolvedValue(
      createTestIdentity({
        nationalIdentityNumberVerified: false,
      }),
    );

    await expect(
      authenticateNationalIdentityNumber(ctx, {
        nationalIdentityNumber: "202202050101",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        nationalIdentityNumberVerified: true,
      }),
    );
  });

  test("should resolve created identity", async () => {
    ctx.repository.identityRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      authenticateNationalIdentityNumber(ctx, {
        nationalIdentityNumber: "202202050101",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.create).toHaveBeenCalled();
  });

  test("should throw on unauthorized", async () => {
    ctx.repository.identityRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      authenticateNationalIdentityNumber(ctx, {
        identityId: "identityId",
        nationalIdentityNumber: "202202050101",
      }),
    ).rejects.toThrow(ClientError);
  });
});
