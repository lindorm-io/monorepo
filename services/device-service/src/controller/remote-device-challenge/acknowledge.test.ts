import { acknowledgeRdcController } from "./acknowledge";
import { createMockCache } from "@lindorm-io/redis";
import { createTestRdcSession } from "../../fixtures/entity";

jest.mock("../../middleware");

describe("acknowledgeRdcController", () => {
  let ctx: any;

  beforeEach(async () => {
    ctx = {
      axios: {
        communicationClient: {
          post: jest.fn(),
        },
        oauthClient: {},
      },
      cache: {
        rdcSessionCache: createMockCache(createTestRdcSession),
      },
      entity: {
        rdcSession: createTestRdcSession({
          id: "859858ee-4be6-47a8-8d22-f0f6393f2651",
          deviceLinks: ["e68ec1b8-786a-443d-bd94-18ba78b95ca0"],
          identityId: "9b6c9a47-7335-4ad5-85ed-af698199cdd9",
          nonce: "45Bd49BnDaKJbJM1",
          scopes: ["scope"],
        }),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({
          token: "jwt.jwt.jwt",
          expiresIn: 1234,
        })),
      },
      metadata: {
        client: {
          id: "5845e43c-26d4-490b-a0fe-0c6fd83c602c",
        },
        device: {
          linkId: "e68ec1b8-786a-443d-bd94-18ba78b95ca0",
        },
      },
    };
  });

  test("should resolve with rdc session status", async () => {
    await expect(acknowledgeRdcController(ctx)).resolves.toStrictEqual({
      body: {
        id: "859858ee-4be6-47a8-8d22-f0f6393f2651",
        challenge: {
          clientId: "b639e4ac-81cb-4c4d-8c77-4ff6a4e3e7df",
          identityId: "9b6c9a47-7335-4ad5-85ed-af698199cdd9",
          nonce: "45Bd49BnDaKJbJM1",
          payload: { token: true },
          scopes: ["scope"],
        },
        session: {
          expiresIn: 1234,
          factors: 1,
          rdcSessionToken: "jwt.jwt.jwt",
          status: "acknowledged",
        },
        template: {
          name: "template",
          parameters: { template: true },
        },
      },
    });

    expect(ctx.jwt.sign).toHaveBeenCalled();
    expect(ctx.cache.rdcSessionCache.update).toHaveBeenCalled();
    expect(ctx.axios.communicationClient.post).not.toHaveBeenCalled();
  });

  test("should notify other deviceLinks that session has been acknowledged", async () => {
    ctx.entity.rdcSession.deviceLinks.push("64996f7e-f84a-408a-8e25-57a0d9970eea");

    await expect(acknowledgeRdcController(ctx)).resolves.toBeTruthy();

    expect(ctx.axios.communicationClient.post).toHaveBeenCalled();
  });
});
