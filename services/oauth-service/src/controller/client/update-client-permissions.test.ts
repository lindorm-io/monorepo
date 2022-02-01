import { updateClientPermissionsController } from "./update-client-permissions";
import { getTestClient } from "../../test/entity";

describe("updateClientPermissionsController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: {
          update: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
      data: {
        permissions: ["permission1", "permission2"],
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
    await expect(updateClientPermissionsController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.clientRepository.update).toHaveBeenCalled();
    expect(ctx.cache.clientCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: ["permission1", "permission2"],
      }),
    );
  });
});
