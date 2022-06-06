import { ConnectSession, Identifier } from "../../entity";
import { createTestConnectSession, createTestPhoneIdentifier } from "../../fixtures/entity";
import { isIdentifierStoredSeparately as _isIdentifierStoredSeparately } from "../../util";
import { sendConnectSessionMessage } from "./send-connect-session-message";
import { ServerError } from "@lindorm-io/errors";

jest.mock("../../util");

const isIdentifierStoredSeparately = _isIdentifierStoredSeparately as jest.Mock;

describe("sendConnectSessionMessage", () => {
  let ctx: any;
  let identifier: Identifier;
  let connectSession: ConnectSession;

  beforeEach(() => {
    ctx = {
      axios: {
        communicationClient: {
          post: jest.fn(),
        },
        oauthClient: {},
      },
    };

    identifier = createTestPhoneIdentifier();
    connectSession = createTestConnectSession();

    isIdentifierStoredSeparately.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    await expect(
      sendConnectSessionMessage(ctx, identifier, connectSession, "code"),
    ).resolves.toBeUndefined();

    expect(ctx.axios.communicationClient.post).toHaveBeenCalledWith("/internal/send/code", {
      data: {
        content: {
          code: "code",
          expires: new Date("2029-01-01T08:00:00.000Z"),
          sessionId: connectSession.id,
        },
        template: "identifier-connect-session-phone",
        to: identifier.identifier,
        type: "phone",
      },
      middleware: expect.any(Array),
    });
  });

  test("should reject", async () => {
    isIdentifierStoredSeparately.mockImplementation(() => false);

    await expect(
      sendConnectSessionMessage(ctx, identifier, connectSession, "code"),
    ).rejects.toThrow(ServerError);
  });
});
