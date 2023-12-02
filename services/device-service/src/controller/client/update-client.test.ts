import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestClient } from "../../fixtures/entity";
import { updateClientController } from "./update-client";

describe("updateClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        active: false,
        name: "New Name",
      },
      entity: {
        client: createTestClient(),
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
      },
    };
  });

  test("should update a client", async () => {
    await expect(updateClientController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.clientRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: false,
        name: "New Name",
      }),
    );
  });
});
