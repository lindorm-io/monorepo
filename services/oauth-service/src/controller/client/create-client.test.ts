import { createClientController } from "./create-client";

jest.mock("@lindorm-io/core", () => ({
  ...(jest.requireActual("@lindorm-io/core") as object),
  getRandomString: jest.fn().mockImplementation(() => "random-string"),
}));

jest.mock("../../instance", () => ({
  argon: {
    encrypt: jest.fn().mockResolvedValue("encrypted-string"),
  },
}));

describe("createClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: {
          create: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
      data: {
        description: "description",
        identityId: "identityId",
        host: "host",
        logoutUri: "logoutUri",
        name: "name",
        redirectUri: "redirectUri",
      },
      repository: {
        clientRepository: {
          create: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
    };
  });

  test("should resolve created client", async () => {
    await expect(createClientController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        secret: "random-string",
      },
      status: 201,
    });

    expect(ctx.repository.clientRepository.create).toHaveBeenCalled();
    expect(ctx.cache.clientCache.create).toHaveBeenCalled();
  });
});
