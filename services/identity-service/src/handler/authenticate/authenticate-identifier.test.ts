import { ClientError, ServerError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { IdentifierType } from "../../common";
import { Identity } from "../../entity";
import { authenticateIdentifier } from "./authenticate-identifier";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";
import {
  isIdentifierStoredSeparately as _isIdentifierStoredSeparately,
  isPrimaryUsedByIdentifier as _isPrimaryUsedByIdentifier,
} from "../../util";

jest.mock("../../util");

const isIdentifierStoredSeparately = _isIdentifierStoredSeparately as jest.Mock;
const isPrimaryUsedByIdentifier = _isPrimaryUsedByIdentifier as jest.Mock;

describe("authenticateIdentifier", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
        identityRepository: createMockRepository(createTestIdentity),
      },
    };

    isIdentifierStoredSeparately.mockImplementation(() => true);
    isPrimaryUsedByIdentifier.mockImplementation(() => true);
  });

  test("should resolve found identity", async () => {
    await expect(
      authenticateIdentifier(ctx, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(expect.any(Identity));
  });

  test("should resolve found and verified identity", async () => {
    ctx.repository.identifierRepository.find.mockResolvedValue(
      createTestEmailIdentifier({
        identityId: "identityId",
      }),
    );

    await expect(
      authenticateIdentifier(ctx, {
        identifier: "test@lindorm.io",
        identityId: "identityId",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(expect.any(Identity));
  });

  test("should resolve and set identifier as verified", async () => {
    ctx.repository.identifierRepository.find.mockResolvedValue(
      createTestEmailIdentifier({
        verified: false,
      }),
    );

    await expect(
      authenticateIdentifier(ctx, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identifierRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ verified: true }),
    );
  });

  test("should resolve created identity with primary identifier", async () => {
    ctx.repository.identifierRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      authenticateIdentifier(ctx, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identifierRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ primary: true }),
    );
  });

  test("should resolve created identity with non-primary identifier", async () => {
    ctx.repository.identifierRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    isPrimaryUsedByIdentifier.mockImplementation(() => false);

    await expect(
      authenticateIdentifier(ctx, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identifierRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ primary: false }),
    );
  });

  test("should throw on invalid identifier type", async () => {
    isIdentifierStoredSeparately.mockImplementation(() => false);

    await expect(
      authenticateIdentifier(ctx, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).rejects.toThrow(ServerError);
  });

  test("should throw on unauthorized", async () => {
    ctx.repository.identifierRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      authenticateIdentifier(ctx, {
        identifier: "test@lindorm.io",
        identityId: "identityId",
        type: IdentifierType.EMAIL,
      }),
    ).rejects.toThrow(ClientError);
  });
});
