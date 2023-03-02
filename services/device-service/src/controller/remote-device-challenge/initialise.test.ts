import MockDate from "mockdate";
import { createRdcSession as _createRdcSession } from "../../handler";
import { initialiseRdcController } from "./initialise";
import { createTestRdcSession } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const createRdcSession = _createRdcSession as jest.Mock;

describe("initialiseRdcController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        callbackUri: "callbackUri",
        identityId: "identityId",
        nonce: "nonce",
        payload: "payload",
        scopes: "scopes",
        template: "template",
      },
    };

    createRdcSession.mockResolvedValue(
      createTestRdcSession({
        id: "rdcSessionId",
        expires: new Date("2021-01-10T08:00:00.000Z"),
      }),
    );
  });

  test("should resolve with rdc session", async () => {
    await expect(initialiseRdcController(ctx)).resolves.toStrictEqual({
      body: {
        id: "rdcSessionId",
        expires: "2021-01-10T08:00:00.000Z",
      },
      status: 202,
    });

    expect(createRdcSession).toHaveBeenCalled();
  });
});
