import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { createRdcSession } from "./create";
import { createTestDeviceLink, createTestRdcSession } from "../../fixtures/entity";
import { RdcSession } from "../../entity";
import { createMockRedisRepository } from "@lindorm-io/redis";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../middleware");

describe("createRdcSession", () => {
  let ctx: any;
  let options: any;

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
      mongo: {
        deviceLinkRepository: {
          findMany: jest.fn().mockResolvedValue([
            await createTestDeviceLink({
              id: "86593641-5f30-47fd-9890-db02796a4b44",
            }),
            await createTestDeviceLink({
              id: "8372ef57-973a-4528-83f9-6e9de13a865d",
            }),
          ]),
        },
      },
    };

    options = {
      callbackUri: "callbackUri",
      deviceLinkId: "deviceLinkId",
      expires: new Date("2021-01-01T08:15:00.000Z"),
      identityId: "identityId",
      mode: "push_notification",
      nonce: "nonce",
      payload: { test: true },
      scopes: ["scope"],
      template: "template",
      type: "callback",
    };
  });

  test("should resolve with a created push_notification session", async () => {
    await expect(createRdcSession(ctx, options)).resolves.toStrictEqual(expect.any(RdcSession));

    expect(ctx.redis.rdcSessionCache.create).toHaveBeenCalled();
    expect(ctx.mongo.deviceLinkRepository.findMany).toHaveBeenCalled();
    expect(ctx.axios.communicationClient.post).toHaveBeenCalled();
  });

  test("should resolve with a created qr_code session", async () => {
    options.mode = "qr_code";

    await expect(createRdcSession(ctx, options)).resolves.toStrictEqual(expect.any(RdcSession));

    expect(ctx.redis.rdcSessionCache.create).toHaveBeenCalled();
    expect(ctx.mongo.deviceLinkRepository.findMany).not.toHaveBeenCalled();
    expect(ctx.axios.communicationClient.post).not.toHaveBeenCalled();
  });

  test("should throw on invalid input", async () => {
    options.identityId = undefined;

    await expect(createRdcSession(ctx, options)).rejects.toThrow(ClientError);
  });
});
