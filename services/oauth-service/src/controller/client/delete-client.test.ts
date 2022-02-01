import { deleteClientController } from "./delete-client";
import { getTestClient } from "../../test/entity";

describe("deleteClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: {
          destroy: jest.fn(),
        },
      },
      entity: {
        client: getTestClient(),
      },
      repository: {
        clientRepository: {
          destroy: jest.fn(),
        },
      },
    };
  });

  test("should resolve destroyed client", async () => {
    await expect(deleteClientController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.clientRepository.destroy).toHaveBeenCalled();
    expect(ctx.cache.clientCache.destroy).toHaveBeenCalled();
  });
});
