import { RdcSessionType } from "../../common";
import { confirmRdcController } from "./confirm";
import { createMockCache } from "@lindorm-io/redis";
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
        rdcSessionCache: createMockCache(),
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
    await expect(confirmRdcController(ctx)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient.request).toHaveBeenCalled();
  });

  test("should resolve with rdc session [ ENROLMENT ]", async () => {
    ctx.entity.rdcSession = getTestRdcSession({
      type: RdcSessionType.ENROLMENT,
    });

    await expect(confirmRdcController(ctx)).resolves.toBeUndefined();

    expect(updateEnrolmentStatus).toHaveBeenCalled();
  });
});
