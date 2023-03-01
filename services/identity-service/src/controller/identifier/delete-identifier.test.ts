import { ClientError } from "@lindorm-io/errors";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier } from "../../fixtures/entity";
import { deleteIdentifierController } from "./delete-identifier";

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
        identifier: createTestEmailIdentifier({
          primary: false,
        }),
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

  test("should throw on primary identifier", async () => {
    ctx.entity.identifier = createTestEmailIdentifier({
      primary: true,
    });

    await expect(deleteIdentifierController(ctx)).rejects.toThrow(ClientError);
  });
});
