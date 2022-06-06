import { ClientError } from "@lindorm-io/errors";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier } from "../../fixtures/entity";
import { isPrimaryUsedByIdentifier as _isPrimaryUsedByIdentifier } from "../../util";
import { setIdentifierAsPrimary } from "./set-identifier-as-primary";
import { Identifier } from "../../entity";

jest.mock("../../util");

const isPrimaryUsedByIdentifier = _isPrimaryUsedByIdentifier as jest.Mock;

describe("setIdentifierAsPrimary", () => {
  let ctx: any;
  let identifier: Identifier;

  beforeEach(() => {
    ctx = {
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
      },
    };

    identifier = createTestEmailIdentifier({
      primary: false,
    });

    isPrimaryUsedByIdentifier.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    ctx.repository.identifierRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    await expect(setIdentifierAsPrimary(ctx, identifier)).resolves.toStrictEqual(
      expect.any(Identifier),
    );

    expect(ctx.repository.identifierRepository.update).toHaveBeenCalledTimes(1);
  });

  test("should resolve with switched primary", async () => {
    await expect(setIdentifierAsPrimary(ctx, identifier)).resolves.toStrictEqual(
      expect.any(Identifier),
    );

    expect(ctx.repository.identifierRepository.update).toHaveBeenCalledTimes(2);

    expect(ctx.repository.identifierRepository.update.mock.calls[0][0]).toStrictEqual(
      expect.objectContaining({
        primary: false,
      }),
    );

    expect(ctx.repository.identifierRepository.update.mock.calls[1][0]).toStrictEqual(
      expect.objectContaining({
        primary: true,
      }),
    );
  });

  test("should reject invalid identifier type", async () => {
    isPrimaryUsedByIdentifier.mockImplementation(() => false);

    await expect(setIdentifierAsPrimary(ctx, identifier)).rejects.toThrow(ClientError);
  });
});
