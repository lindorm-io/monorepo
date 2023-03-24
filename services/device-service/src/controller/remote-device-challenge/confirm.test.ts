import { confirmRdcController } from "./confirm";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestRdcSession } from "../../fixtures/entity";
import { updateEnrolmentStatus as _updateEnrolmentStatus } from "../../handler";
import { RdcSessionType } from "@lindorm-io/common-types";

jest.mock("../../handler");
jest.mock("../../util");

const updateEnrolmentStatus = _updateEnrolmentStatus as jest.Mock;

describe("confirmRdcController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          request: jest.fn(),
        },
        oauthClient: {},
      },
      redis: {
        rdcSessionCache: createMockRedisRepository(createTestRdcSession),
      },
      entity: {
        rdcSession: createTestRdcSession({
          id: "8f3e88fc-445c-447a-ba48-81535366a8ec",
          identityId: "c056fe10-ffe3-4229-8886-602ce8715a61",
          nonce: "QxEQ4H21R-gslTwr",
        }),
      },
      token: {
        bearerToken: {
          subject: "c056fe10-ffe3-4229-8886-602ce8715a61",
        },
        challengeConfirmationToken: {
          token: "jwt.jwt.jwt",
          claims: {
            factors: ["1", "2"],
          },
          nonce: "QxEQ4H21R-gslTwr",
          subject: "c056fe10-ffe3-4229-8886-602ce8715a61",
        },
        rdcSessionToken: {
          session: "8f3e88fc-445c-447a-ba48-81535366a8ec",
        },
      },
    };
  });

  test("should resolve with rdc session [ CALLBACK ]", async () => {
    await expect(confirmRdcController(ctx)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.request).toHaveBeenCalled();
  });

  test("should resolve with rdc session [ ENROLMENT ]", async () => {
    ctx.entity.rdcSession = createTestRdcSession({
      id: "8f3e88fc-445c-447a-ba48-81535366a8ec",
      identityId: "c056fe10-ffe3-4229-8886-602ce8715a61",
      nonce: "QxEQ4H21R-gslTwr",
      type: RdcSessionType.ENROLMENT,
    });

    await expect(confirmRdcController(ctx)).resolves.toBeUndefined();

    expect(updateEnrolmentStatus).toHaveBeenCalled();
  });
});
