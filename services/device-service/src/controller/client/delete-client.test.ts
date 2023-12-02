import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestClient, createTestPublicKey } from "../../fixtures/entity";
import { deleteClientController } from "./delete-client";

describe("deleteClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: createTestClient(),
        publicKey: createTestPublicKey(),
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
        publicKeyRepository: createMockMongoRepository(createTestPublicKey),
      },
    };
  });

  test("should delete a client", async () => {
    await expect(deleteClientController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.clientRepository.destroy).toHaveBeenCalled();
    expect(ctx.mongo.publicKeyRepository.destroy).toHaveBeenCalled();
  });
});
