import { RdcSessionType } from "../../common";
import { confirmRdcController } from "./confirm";
import { getTestRdcSession } from "../../test/entity";
import { updateEnrolmentStatus as _updateEnrolmentStatus } from "../../handler";

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
      cache: {
        rdcSessionCache: {
          update: jest.fn(),
        },
      },
      entity: {
        rdcSession: getTestRdcSession(),
      },
      token: {
        challengeConfirmationToken: {
          token: "jwt.jwt.jwt",
          claims: {
            factors: ["1", "2"],
          },
        },
      },
    };
  });

  test("should resolve with rdc session [ CALLBACK ]", async () => {
    await expect(confirmRdcController(ctx)).resolves.toStrictEqual({
      body: {},
      status: 202,
    });

    expect(ctx.axios.axiosClient.request).toHaveBeenCalled();
  });

  test("should resolve with rdc session [ ENROLMENT ]", async () => {
    ctx.entity.rdcSession = getTestRdcSession({
      type: RdcSessionType.ENROLMENT,
    });

    await expect(confirmRdcController(ctx)).resolves.toBeTruthy();

    expect(updateEnrolmentStatus).toHaveBeenCalled();
  });
});
