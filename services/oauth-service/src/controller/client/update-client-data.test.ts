import { updateClientDataController } from "./update-client-data";
import { getTestClient } from "../../test/entity";

describe("updateClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: {
          update: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
      data: {
        allowed: {
          grantTypes: ["new_grantTypes"],
          responseTypes: ["new_responseTypes"],
          scopes: ["new_scopes"],
        },
        defaults: {
          displayMode: "new_displayMode",
          levelOfAssurance: "new_levelOfAssurance",
          responseMode: "new_responseMode",
        },
        description: "new_description",
        expiry: {
          accessToken: "new_accessToken",
          idToken: "new_idToken",
          refreshToken: "new_refreshToken",
        },
        host: "new_",
        logoutUri: "new_logoutUri",
        name: "new_name",
        redirectUri: "new_redirectUri",
        scopeDescriptions: "new_scopeDescriptions",
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
    await expect(updateClientDataController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.clientRepository.update).toHaveBeenCalled();
    expect(ctx.cache.clientCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        allowed: {
          grantTypes: ["new_grantTypes"],
          responseTypes: ["new_responseTypes"],
          scopes: ["new_scopes"],
        },
        defaults: {
          displayMode: "new_displayMode",
          levelOfAssurance: "new_levelOfAssurance",
          responseMode: "new_responseMode",
        },
        description: "new_description",
        expiry: {
          accessToken: "new_accessToken",
          idToken: "new_idToken",
          refreshToken: "new_refreshToken",
        },
        logoutUri: "new_logoutUri",
        name: "new_name",
        redirectUri: "new_redirectUri",
        scopeDescriptions: "new_scopeDescriptions",
      }),
    );
  });
});
