import { RdcSessionType } from "../../common";
import { rejectRdcController } from "./reject";
import { getTestRdcSession } from "../../test/entity";
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
        rdcSessionCache: {
          update: jest.fn(),
        },
      },
      entity: {
        rdcSession: getTestRdcSession(),
      },
    };
  });

  test("should resolve with rdc session [ CALLBACK ]", async () => {
    await expect(rejectRdcController(ctx)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.request).toHaveBeenCalled();
  });

  test("should resolve with rdc session [ ENROLMENT ]", async () => {
    ctx.entity.rdcSession = getTestRdcSession({
      type: RdcSessionType.ENROLMENT,
    });

    await expect(rejectRdcController(ctx)).resolves.toBeUndefined();

    expect(updateEnrolmentStatus).toHaveBeenCalled();
  });
});
