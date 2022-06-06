import { deleteIdentifierController } from "./delete-identifier";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";
import { createMockRepository } from "@lindorm-io/mongo";

describe("deleteIdentifierController", () => {
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
  });

  test("should resolve", async () => {
    await expect(deleteIdentifierController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identifierRepository.destroy).toHaveBeenCalled();
  });
});
