import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestRdcSession } from "../../fixtures/entity";
import { getDeviceHeaders as _getDeviceHeaders } from "../../handler";
import { acknowledgeRdcController } from "./acknowledge";

jest.mock("../../handler");
jest.mock("../../middleware");

const getDeviceHeaders = _getDeviceHeaders as jest.Mock;

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
      redis: {
        rdcSessionCache: createMockRedisRepository(createTestRdcSession),
      },
      entity: {
        rdcSession: createTestRdcSession({
          id: "859858ee-4be6-47a8-8d22-f0f6393f2651",
          deviceLinks: ["2b16e7e6-8e88-4b5f-b667-e4b52b9ac853"],
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
      token: {
        bearerToken: {
          subject: "9b6c9a47-7335-4ad5-85ed-af698199cdd9",
        },
      },
    };

    getDeviceHeaders.mockReturnValue({
      installationId: "b75393fd-2cdf-449a-810f-b14c0d11e871",
      linkId: "2b16e7e6-8e88-4b5f-b667-e4b52b9ac853",
      name: "name",
      systemVersion: "1.0.0",
      uniqueId: "474aacfa09474d4caaf903977b896213",
    });
  });

  test("should resolve with rdc session status", async () => {
    await expect(acknowledgeRdcController(ctx)).resolves.toStrictEqual({
      body: {
        id: "859858ee-4be6-47a8-8d22-f0f6393f2651",
        challenge: {
          audiences: ["7bb4396b-5bad-4e6e-8edb-4f0f3c20e902"],
          identityId: "9b6c9a47-7335-4ad5-85ed-af698199cdd9",
          nonce: "45Bd49BnDaKJbJM1",
          payload: { token: true },
          scopes: ["scope"],
        },
        session: {
          expires: "2021-01-10T08:00:00.000Z",
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
    expect(ctx.redis.rdcSessionCache.update).toHaveBeenCalled();
    expect(ctx.axios.communicationClient.post).not.toHaveBeenCalled();
  });

  test("should notify other deviceLinks that session has been acknowledged", async () => {
    ctx.entity.rdcSession.deviceLinks.push("64996f7e-f84a-408a-8e25-57a0d9970eea");

    await expect(acknowledgeRdcController(ctx)).resolves.toBeTruthy();

    expect(ctx.axios.communicationClient.post).toHaveBeenCalled();
  });
});
