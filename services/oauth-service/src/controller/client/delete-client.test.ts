import { createMockMongoRepository } from "@lindorm-io/mongo";
import { deleteClientController } from "./delete-client";
import { createTestClient } from "../../fixtures/entity";

describe("deleteClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: createTestClient(),
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
      },
    };
  });

  test("should resolve destroyed client", async () => {
    await expect(deleteClientController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.clientRepository.destroy).toHaveBeenCalled();
  });
});
