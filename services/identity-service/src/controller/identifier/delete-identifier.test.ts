import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
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
      mongo: {
        identifierRepository: createMockMongoRepository(createTestEmailIdentifier),
      },
    };
  });

  test("should resolve", async () => {
    await expect(deleteIdentifierController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.identifierRepository.destroy).toHaveBeenCalled();
  });

  test("should throw on primary identifier", async () => {
    ctx.entity.identifier = createTestEmailIdentifier({
      primary: true,
    });

    await expect(deleteIdentifierController(ctx)).rejects.toThrow(ClientError);
  });
});
