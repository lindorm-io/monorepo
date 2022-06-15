import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identity } from "../../entity";
import { authenticateNationalIdentityNumber } from "./authenticate-national-identity-number";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestIdentity } from "../../fixtures/entity";
import { ClientError } from "@lindorm-io/errors";

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
        id: "347221b1-9a7e-4040-af7f-135b02c0e07b",
      }),
    );

    await expect(
      authenticateNationalIdentityNumber(ctx, {
        identityId: "347221b1-9a7e-4040-af7f-135b02c0e07b",
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

    expect(ctx.repository.identityRepository.findOrCreate).toHaveBeenCalled();
  });

  test("should resolve created identity with specific id", async () => {
    ctx.repository.identityRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      authenticateNationalIdentityNumber(ctx, {
        identityId: "347221b1-9a7e-4040-af7f-135b02c0e07b",
        nationalIdentityNumber: "202202050101",
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "347221b1-9a7e-4040-af7f-135b02c0e07b",
      }),
    );
  });

  test("should throw on invalid identity", async () => {
    ctx.repository.identityRepository.find.mockResolvedValue(
      createTestIdentity({
        id: "21aafd9d-c139-4696-a0e6-36bea99cc6a4",
      }),
    );

    await expect(
      authenticateNationalIdentityNumber(ctx, {
        identityId: "347221b1-9a7e-4040-af7f-135b02c0e07b",
        nationalIdentityNumber: "202202050101",
      }),
    ).rejects.toThrow(ClientError);
  });
});
