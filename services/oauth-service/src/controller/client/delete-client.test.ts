import { createMockRepository } from "@lindorm-io/mongo";
import { deleteClientController } from "./delete-client";
import { createTestClient } from "../../fixtures/entity";

describe("deleteClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: createTestClient(),
      },
      repository: {
        clientRepository: createMockRepository(createTestClient),
      },
    };
  });

  test("should resolve destroyed client", async () => {
    await expect(deleteClientController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.clientRepository.destroy).toHaveBeenCalled();
  });
});
