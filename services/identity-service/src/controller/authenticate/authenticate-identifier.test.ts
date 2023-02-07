import { authenticateIdentifierController } from "./authenticate-identifier";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestIdentity } from "../../fixtures/entity";
import {
  authenticateIdentifier as _authenticateIdentifier,
  authenticateNationalIdentityNumber as _authenticateNationalIdentityNumber,
} from "../../handler";

jest.mock("../../handler");

const authenticateIdentifier = _authenticateIdentifier as jest.Mock;
const authenticateNationalIdentityNumber = _authenticateNationalIdentityNumber as jest.Mock;

describe("authenticateIdentifierController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        identifier: "identifier",
        identityId: "identityId",
        provider: "provider",
        type: "type",
      },
      repository: {
        identityRepository: createMockRepository((options) =>
          createTestIdentity({
            id: "identityId",
            ...options,
          }),
        ),
      },
    };

    authenticateIdentifier.mockResolvedValue(
      createTestIdentity({
        id: "identityId",
      }),
    );

    authenticateNationalIdentityNumber.mockResolvedValue(
      createTestIdentity({
        id: "identityId",
      }),
    );
  });

  test("should resolve authenticated identifier", async () => {
    ctx.data.type = "email";

    await expect(authenticateIdentifierController(ctx)).resolves.toStrictEqual({
      body: { identityId: "identityId" },
    });

    expect(authenticateIdentifier).toHaveBeenCalled();
  });

  test("should resolve authenticated nin", async () => {
    ctx.data.type = "nin";

    await expect(authenticateIdentifierController(ctx)).resolves.toStrictEqual({
      body: { identityId: "identityId" },
    });

    expect(authenticateNationalIdentityNumber).toHaveBeenCalled();
  });

  test("should resolve authenticated username", async () => {
    ctx.data.type = "username";

    await expect(authenticateIdentifierController(ctx)).resolves.toStrictEqual({
      body: { identityId: "identityId" },
    });

    expect(ctx.repository.identityRepository.find).toHaveBeenCalled();
  });
});
