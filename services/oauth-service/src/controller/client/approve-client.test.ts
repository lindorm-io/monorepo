import { approveClientController } from "./approve-client";
import { getTestClient } from "../../test/entity";

describe("approveClientController", () => {
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
          active: false,
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
    await expect(approveClientController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.clientRepository.update).toHaveBeenCalled();
    expect(ctx.cache.clientCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
      }),
    );
  });
});
