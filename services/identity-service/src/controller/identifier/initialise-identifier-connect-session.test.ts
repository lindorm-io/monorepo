import { initialiseIdentifierConnectSessionController } from "./initialise-identifier-connect-session";
import {
  createTestConnectSession,
  createTestEmailIdentifier,
  createTestIdentity,
} from "../../fixtures/entity";
import {
  getIdentifierEntity as _getIdentifierEntity,
  initialiseConnectSession as _initialiseConnectSession,
  sendConnectSessionMessage as _sendConnectSessionMessage,
} from "../../handler";
import { ClientError } from "@lindorm-io/errors";

jest.mock("../../handler");

const getIdentifierEntity = _getIdentifierEntity as jest.Mock;
const initialiseConnectSession = _initialiseConnectSession as jest.Mock;
const sendConnectSessionMessage = _sendConnectSessionMessage as jest.Mock;

describe("initialiseIdentifierConnectSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        identifier: "identifier",
        type: "type",
      },
      entity: {
        identity: createTestIdentity(),
      },
    };

    getIdentifierEntity.mockResolvedValue(
      createTestEmailIdentifier({
        verified: false,
      }),
    );
    initialiseConnectSession.mockResolvedValue(createTestConnectSession());
  });

  test("should resolve", async () => {
    await expect(initialiseIdentifierConnectSessionController(ctx)).resolves.toBeUndefined();

    expect(getIdentifierEntity).toHaveBeenCalled();
    expect(initialiseConnectSession).toHaveBeenCalled();
    expect(sendConnectSessionMessage).toHaveBeenCalled();
  });

  test("should reject verified identifier", async () => {
    getIdentifierEntity.mockResolvedValue(
      createTestEmailIdentifier({
        verified: true,
      }),
    );

    await expect(initialiseIdentifierConnectSessionController(ctx)).rejects.toThrow(ClientError);
  });
});
