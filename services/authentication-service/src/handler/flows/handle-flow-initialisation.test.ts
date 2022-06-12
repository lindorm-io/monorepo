import MockDate from "mockdate";
import { FlowType } from "../../enum";
import { LoginSession } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestFlowSession, createTestLoginSession } from "../../fixtures/entity";
import { handleFlowInitialisation } from "./handle-flow-initialisation";
import {
  isPollingRequired as _isPollingRequired,
  isTokenReturned as _isTokenReturned,
} from "../../util";
import {
  initialiseBankIdSeFlow as _initialiseBankIdSeFlow,
  initialiseEmailLinkFlow as _initialiseEmailLinkFlow,
} from "../../handler";

MockDate.set("2022-01-01T07:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const isPollingRequired = _isPollingRequired as jest.Mock;
const isTokenReturned = _isTokenReturned as jest.Mock;
const initialiseBankIdSeFlow = _initialiseBankIdSeFlow as jest.Mock;
const initialiseEmailLinkFlow = _initialiseEmailLinkFlow as jest.Mock;

describe("handleFlowInitialisation", () => {
  let ctx: any;
  let loginSession: LoginSession;
  let options: any;

  beforeEach(() => {
    ctx = {
      cache: {
        flowSessionCache: createMockCache(createTestFlowSession),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({ token: "jwt.jwt.jwt" })),
      },
      logger: createMockLogger(),
    };

    loginSession = createTestLoginSession();

    options = {
      email: "email",
      flowType: FlowType.BANK_ID_SE,
      nonce: "nonce",
      phoneNumber: "phoneNumber",
      username: "username",
    };

    isPollingRequired.mockImplementation(() => true);
    isTokenReturned.mockImplementation(() => true);
    initialiseBankIdSeFlow.mockResolvedValue(undefined);
    initialiseEmailLinkFlow.mockResolvedValue(undefined);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve Bank ID", async () => {
    await expect(handleFlowInitialisation(ctx, loginSession, options)).resolves.toStrictEqual({
      flowToken: "jwt.jwt.jwt",
      id: expect.any(String),
      pollingRequired: true,
    });

    expect(initialiseBankIdSeFlow).toHaveBeenCalled();
    expect(initialiseEmailLinkFlow).not.toHaveBeenCalled();
  });

  test("should resolve Email Link", async () => {
    options.flowType = FlowType.EMAIL_LINK;

    await expect(handleFlowInitialisation(ctx, loginSession, options)).resolves.toStrictEqual({
      flowToken: "jwt.jwt.jwt",
      id: expect.any(String),
      pollingRequired: true,
    });

    expect(initialiseEmailLinkFlow).toHaveBeenCalled();
    expect(initialiseBankIdSeFlow).not.toHaveBeenCalled();
  });
});
