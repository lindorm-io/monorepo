import { EntityNotFoundError } from "@lindorm-io/entity";
import { IdentifierType } from "../../common";
import { Identity } from "../../entity";
import { ClientError, ServerError } from "@lindorm-io/errors";
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
        identityId: "73dd1131-9cbc-4d11-ac8d-3f76e556f0a3",
      }),
    );

    await expect(
      authenticateIdentifier(ctx, {
        identifier: "test@lindorm.io",
        identityId: "73dd1131-9cbc-4d11-ac8d-3f76e556f0a3",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(expect.any(Identity));
  });

  test("should resolve created identity with specific id", async () => {
    ctx.repository.identifierRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      authenticateIdentifier(ctx, {
        identifier: "test@lindorm.io",
        identityId: "73dd1131-9cbc-4d11-ac8d-3f76e556f0a3",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(expect.any(Identity));

    expect(ctx.repository.identityRepository.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "73dd1131-9cbc-4d11-ac8d-3f76e556f0a3",
      }),
    );
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
    ctx.repository.identifierRepository.count.mockResolvedValue(0);

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

  test("should throw on invalid identity", async () => {
    ctx.repository.identifierRepository.find.mockResolvedValue(
      createTestEmailIdentifier({
        identityId: "73dd1131-9cbc-4d11-ac8d-3f76e556f0a3",
      }),
    );

    await expect(
      authenticateIdentifier(ctx, {
        identifier: "test@lindorm.io",
        identityId: "2dbf0b95-4798-4f6a-b8c8-8be39b2a779d",
        type: IdentifierType.EMAIL,
      }),
    ).rejects.toThrow(ClientError);
  });
});
