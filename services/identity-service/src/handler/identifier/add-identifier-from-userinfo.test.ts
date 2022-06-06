import { EntityNotFoundError } from "@lindorm-io/entity";
import { IdentifierType } from "../../common";
import { Identity } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { addIdentifierFromUserinfo } from "./add-identifier-from-userinfo";
import { createMockRepository } from "@lindorm-io/mongo";
import {
  createTestConnectSession,
  createTestEmailIdentifier,
  createTestIdentity,
} from "../../fixtures/entity";
import { initialiseConnectSession as _initialiseConnectSession } from "./initialise-connect-session";
import { sendConnectSessionMessage as _sendConnectSessionMessage } from "./send-connect-session-message";
import {
  isIdentifierStoredSeparately as _isIdentifierStoredSeparately,
  isPrimaryUsedByIdentifier as _isPrimaryUsedByIdentifier,
} from "../../util";

jest.mock("../../util");
jest.mock("./initialise-connect-session");
jest.mock("./send-connect-session-message");

const isIdentifierStoredSeparately = _isIdentifierStoredSeparately as jest.Mock;
const isPrimaryUsedByIdentifier = _isPrimaryUsedByIdentifier as jest.Mock;
const initialiseConnectSession = _initialiseConnectSession as jest.Mock;
const sendConnectSessionMessage = _sendConnectSessionMessage as jest.Mock;

describe("addIdentifierFromUserinfo", () => {
  let ctx: any;
  let identity: Identity;

  beforeEach(() => {
    ctx = {
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
      },
    };

    identity = createTestIdentity();

    isIdentifierStoredSeparately.mockImplementation(() => true);
    isPrimaryUsedByIdentifier.mockImplementation(() => true);
    initialiseConnectSession.mockResolvedValue(createTestConnectSession());
  });

  test("should resolve found identifier", async () => {
    ctx.repository.identifierRepository.find.mockImplementation(async (options: any) =>
      createTestEmailIdentifier(options),
    );

    await expect(
      addIdentifierFromUserinfo(ctx, identity, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        identifier: "test@lindorm.io",
        provider: "https://test.lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    );
  });

  test("should resolve created primary identifier", async () => {
    ctx.repository.identifierRepository.find.mockRejectedValue(new EntityNotFoundError("message"));
    ctx.repository.identifierRepository.count.mockResolvedValue(0);

    await expect(
      addIdentifierFromUserinfo(ctx, identity, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        identifier: "test@lindorm.io",
        primary: true,
        provider: "https://test.lindorm.io",
        type: IdentifierType.EMAIL,
        verified: false,
      }),
    );

    expect(ctx.repository.identifierRepository.create).toHaveBeenCalled();
    expect(initialiseConnectSession).toHaveBeenCalled();
    expect(sendConnectSessionMessage).toHaveBeenCalled();
  });

  test("should resolve created identifier", async () => {
    ctx.repository.identifierRepository.find.mockRejectedValue(new EntityNotFoundError("message"));
    ctx.repository.identifierRepository.count.mockResolvedValue(2);

    await expect(
      addIdentifierFromUserinfo(ctx, identity, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        identifier: "test@lindorm.io",
        primary: false,
        provider: "https://test.lindorm.io",
        type: IdentifierType.EMAIL,
        verified: false,
      }),
    );
  });

  test("should resolve created non-primary identifier", async () => {
    ctx.repository.identifierRepository.find.mockRejectedValue(new EntityNotFoundError("message"));

    isPrimaryUsedByIdentifier.mockImplementation(() => false);

    await expect(
      addIdentifierFromUserinfo(ctx, identity, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        identifier: "test@lindorm.io",
        primary: false,
        provider: "https://test.lindorm.io",
        type: IdentifierType.EMAIL,
        verified: false,
      }),
    );
  });

  test("should throw on invalid identifier type", async () => {
    isIdentifierStoredSeparately.mockImplementation(() => false);

    await expect(
      addIdentifierFromUserinfo(ctx, identity, {
        identifier: "test@lindorm.io",
        type: IdentifierType.EMAIL,
      }),
    ).rejects.toThrow(ServerError);
  });
});
