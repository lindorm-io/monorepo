import { revokeClientController } from "./revoke-client";
import { getTestClient } from "../../test/entity";

describe("revokeClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: {
          update: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
      entity: {
        client: getTestClient({
          active: true,
        }),
      },
      repository: {
        clientRepository: {
          update: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
    };
  });

  test("should resolve updated client", async () => {
    await expect(revokeClientController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.clientRepository.update).toHaveBeenCalled();
    expect(ctx.cache.clientCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: false,
      }),
    );
  });
});
