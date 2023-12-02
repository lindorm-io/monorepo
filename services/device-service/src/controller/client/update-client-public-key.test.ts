import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestClient, createTestPublicKey } from "../../fixtures/entity";
import { updateClientPublicKeyController } from "./update-client-public-key";

describe("updateClientPublicKeyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        publicKey: "new-public-key",
      },
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

  test("should update a client public key", async () => {
    await expect(updateClientPublicKeyController(ctx)).resolves.toStrictEqual({
      body: {
        publicKeyId: expect.any(String),
      },
    });

    expect(ctx.mongo.clientRepository.update).toHaveBeenCalled();
    expect(ctx.mongo.publicKeyRepository.destroy).toHaveBeenCalled();
    expect(ctx.mongo.publicKeyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "new-public-key",
      }),
    );
  });
});
