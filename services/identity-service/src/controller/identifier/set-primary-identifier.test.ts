import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";
import { findVerifiedIdentifier as _findVerifiedIdentifier } from "../../handler";
import { isPrimaryUsedByIdentifier as _isPrimaryUsedByIdentifier } from "../../util";
import { setPrimaryIdentifierController } from "./set-primary-identifier";

jest.mock("../../handler");
jest.mock("../../util");

const findVerifiedIdentifier = _findVerifiedIdentifier as jest.Mock;
const isPrimaryUsedByIdentifier = _isPrimaryUsedByIdentifier as jest.Mock;

describe("setPrimaryIdentifierController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        identifier: "identifier",
        provider: "provider",
        type: "type",
      },
      entity: {
        identity: createTestIdentity(),
      },
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
      },
    };

    findVerifiedIdentifier.mockResolvedValue(createTestEmailIdentifier());
    isPrimaryUsedByIdentifier.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    ctx.repository.identifierRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(setPrimaryIdentifierController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identifierRepository.updateMany).toHaveBeenCalledWith([
      expect.objectContaining({ primary: true }),
    ]);
  });

  test("should resolve with switched primary", async () => {
    await expect(setPrimaryIdentifierController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identifierRepository.updateMany).toHaveBeenCalledWith([
      expect.objectContaining({ primary: false }),
      expect.objectContaining({ primary: true }),
    ]);
  });

  test("should reject invalid identifier type", async () => {
    isPrimaryUsedByIdentifier.mockImplementation(() => false);

    await expect(setPrimaryIdentifierController(ctx)).rejects.toThrow(ClientError);
  });
});
