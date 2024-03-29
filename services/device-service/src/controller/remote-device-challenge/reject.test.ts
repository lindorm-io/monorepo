import { RdcSessionType } from "@lindorm-io/common-enums";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestRdcSession } from "../../fixtures/entity";
import { updateEnrolmentStatus as _updateEnrolmentStatus } from "../../handler";
import { rejectRdcController } from "./reject";

jest.mock("../../handler");

const updateEnrolmentStatus = _updateEnrolmentStatus as jest.Mock;

describe("rejectRdcController", () => {
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
          id: "cadd8cf3-ca5b-4bc5-861e-43e2de54eaeb",
          identityId: "b799b044-16db-495a-b7e1-2cf3175d4b54",
        }),
      },
      token: {
        bearerToken: {
          subject: "b799b044-16db-495a-b7e1-2cf3175d4b54",
        },
        rdcSessionToken: {
          metadata: { session: "cadd8cf3-ca5b-4bc5-861e-43e2de54eaeb" },
        },
      },
    };
  });

  test("should resolve with rdc session [ CALLBACK ]", async () => {
    await expect(rejectRdcController(ctx)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.request).toHaveBeenCalled();
  });

  test("should resolve with rdc session [ ENROLMENT ]", async () => {
    ctx.entity.rdcSession = createTestRdcSession({
      id: "cadd8cf3-ca5b-4bc5-861e-43e2de54eaeb",
      identityId: "b799b044-16db-495a-b7e1-2cf3175d4b54",
      type: RdcSessionType.ENROLMENT,
    });

    await expect(rejectRdcController(ctx)).resolves.toBeUndefined();

    expect(updateEnrolmentStatus).toHaveBeenCalled();
  });
});
