import { AuthenticationMethod } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { getUnixTime } from "date-fns";
import MockDate from "mockdate";
import { createTestClient, createTestClientSession } from "../../fixtures/entity";
import { generateTokenResponse as _generateTokenResponse } from "../oauth";
import { verifyAssertionId as _verifyAssertionId } from "../redis";
import { handleJwtBearerGrant } from "./handle-jwt-bearer-grant";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../oauth");
jest.mock("../token");
jest.mock("../redis");

const generateTokenResponse = _generateTokenResponse as jest.Mock;
const verifyAssertionId = _verifyAssertionId as jest.Mock;

describe("handleJwtBearerGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        assertion: "assertion",
        scope: "openid email profile offline_access",
      },
      entity: {
        client: createTestClient(),
      },
      jwt: {
        verify: jest.fn().mockReturnValue({
          claims: {
            subject: "bb51ea97-6003-4c6b-aedc-d121ea93e17d",
          },
          metadata: {
            authMethodsReference: [AuthenticationMethod.EMAIL],
            expires: getUnixTime(new Date("2021-01-01T09:00:00.000Z")),
          },
        }),
      },
      mongo: {
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
    };

    generateTokenResponse.mockResolvedValue("generateTokenResponse");
    verifyAssertionId.mockResolvedValue(undefined);
  });

  test("should resolve", async () => {
    await expect(handleJwtBearerGrant(ctx)).resolves.toBe("generateTokenResponse");
  });

  test("should throw on invalid scope", async () => {
    ctx.entity.client.allowed.scopes = ["openid", "email"];

    await expect(handleJwtBearerGrant(ctx)).rejects.toThrow(expect.any(ClientError));
  });
});
