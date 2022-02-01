import { updateClientTypeController } from "./update-client-type";
import { getTestClient } from "../../test/entity";

describe("updateClientTypeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: {
          update: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
      data: {
        type: "new_type",
      },
      entity: {
        client: getTestClient(),
      },
      repository: {
        clientRepository: {
          update: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
    };
  });

  test("should resolve updated client", async () => {
    await expect(updateClientTypeController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.clientRepository.update).toHaveBeenCalled();
    expect(ctx.cache.clientCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "new_type",
      }),
    );
  });
});
