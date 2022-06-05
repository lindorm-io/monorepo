import { RdcSessionType } from "../../common";
import { createMockCache } from "@lindorm-io/redis";
import { createTestRdcSession } from "../../fixtures/entity";
import { rejectRdcController } from "./reject";
import { updateEnrolmentStatus as _updateEnrolmentStatus } from "../../handler";

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
      cache: {
        rdcSessionCache: createMockCache(createTestRdcSession),
      },
      entity: {
        rdcSession: createTestRdcSession(),
      },
    };
  });

  test("should resolve with rdc session [ CALLBACK ]", async () => {
    await expect(rejectRdcController(ctx)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.request).toHaveBeenCalled();
  });

  test("should resolve with rdc session [ ENROLMENT ]", async () => {
    ctx.entity.rdcSession = createTestRdcSession({
      type: RdcSessionType.ENROLMENT,
    });

    await expect(rejectRdcController(ctx)).resolves.toBeUndefined();

    expect(updateEnrolmentStatus).toHaveBeenCalled();
  });
});
