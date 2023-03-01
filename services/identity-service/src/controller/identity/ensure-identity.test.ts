import { ensureIdentityController } from "./ensure-identity";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestIdentity } from "../../fixtures/entity";
import { getIdentityResponse as _getIdentityResponse } from "../../handler";

jest.mock("../../handler");

const getIdentityResponse = _getIdentityResponse as jest.Mock;

describe("ensureIdentityController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "f4ed5f0c-45bf-4d5c-aacb-87dfa0522fd0",
      },
      repository: {
        identityRepository: createMockRepository(createTestIdentity),
      },
    };

    getIdentityResponse.mockResolvedValue("getIdentityResponse");
  });

  test("should resolve existing identity", async () => {
    await expect(ensureIdentityController(ctx)).resolves.toStrictEqual({
      body: "getIdentityResponse",
    });

    expect(ctx.repository.identityRepository.create).not.toHaveBeenCalled();
  });

  test("should resolve new identity", async () => {
    ctx.repository.identityRepository.tryFind.mockResolvedValue(undefined);

    await expect(ensureIdentityController(ctx)).resolves.toStrictEqual({
      body: "getIdentityResponse",
    });

    expect(ctx.repository.identityRepository.create).toHaveBeenCalled();
  });
});
