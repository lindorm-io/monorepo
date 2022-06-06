import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";
import { findVerifiedIdentifier as _findVerifiedIdentifier } from "../../handler";
import { setIdentifierLabelController } from "./set-identifier-label";

jest.mock("../../handler");

const findVerifiedIdentifier = _findVerifiedIdentifier as jest.Mock;

describe("setIdentifierLabelController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        identifier: "identifier",
        label: "new-label",
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
  });

  test("should resolve", async () => {
    await expect(setIdentifierLabelController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identifierRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ label: "new-label" }),
    );
  });
});
