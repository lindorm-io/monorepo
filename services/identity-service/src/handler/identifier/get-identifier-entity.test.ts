import { EntityNotFoundError } from "@lindorm-io/entity";
import { Identifier, Identity } from "../../entity";
import { IdentifierType } from "../../common";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";
import { getIdentifierEntity } from "./get-identifier-entity";
import { isIdentifierStoredSeparately as _isIdentifierStoredSeparately } from "../../util";
import { ServerError } from "@lindorm-io/errors";

jest.mock("../../util");

const isIdentifierStoredSeparately = _isIdentifierStoredSeparately as jest.Mock;

describe("getIdentifierEntity", () => {
  let ctx: any;
  let identity: Identity;

  beforeEach(() => {
    ctx = {
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
      },
    };

    identity = createTestIdentity();

    isIdentifierStoredSeparately.mockImplementation(() => true);
  });

  test("should resolve found identifier", async () => {
    await expect(
      getIdentifierEntity(ctx, identity, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(expect.any(Identifier));
  });

  test("should resolve created identifier", async () => {
    ctx.repository.identifierRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(
      getIdentifierEntity(ctx, identity, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(expect.any(Identifier));

    expect(ctx.repository.identifierRepository.create).toHaveBeenCalled();
  });

  test("should throw on invalid identifier type", async () => {
    isIdentifierStoredSeparately.mockImplementation(() => false);

    await expect(
      getIdentifierEntity(ctx, identity, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).rejects.toThrow(ServerError);
  });
});
