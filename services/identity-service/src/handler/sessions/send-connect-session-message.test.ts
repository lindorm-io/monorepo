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
    connectSession = createTestConnectSession({
      id: "4ccac677-8a15-40a2-a19e-f094e1710eb0",
    });

    isIdentifierStoredSeparately.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    await expect(
      sendConnectSessionMessage(ctx, identifier, connectSession, "code"),
    ).resolves.toBeUndefined();

    expect(ctx.axios.communicationClient.post).toHaveBeenCalledWith("/internal/send/code", {
      body: {
        content: {
          expires: new Date("2029-01-01T08:00:00.000Z"),
          url: "https://frontend.url/connect/callback?code=code&session_id=4ccac677-8a15-40a2-a19e-f094e1710eb0",
        },
        template: "identifier-connect-session",
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
