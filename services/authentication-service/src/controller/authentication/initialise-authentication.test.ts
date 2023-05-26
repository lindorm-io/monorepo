import { createTestAuthenticationSession } from "../../fixtures/entity";
import {
  initialiseElevateAuthenticationSession as _initialiseElevateAuthenticationSession,
  initialiseOauthAuthenticationSession as _initialiseOauthAuthenticationSession,
  initialiseStandardAuthenticationSession as _initialiseStandardAuthenticationSession,
} from "../../handler";
import { initialiseAuthenticationController } from "./initialise-authentication";

jest.mock("../../handler");

const initialiseElevateAuthenticationSession = _initialiseElevateAuthenticationSession as jest.Mock;
const initialiseOauthAuthenticationSession = _initialiseOauthAuthenticationSession as jest.Mock;
const initialiseStandardAuthenticationSession =
  _initialiseStandardAuthenticationSession as jest.Mock;

describe("initialiseAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {},
    };

    initialiseElevateAuthenticationSession.mockResolvedValue(
      createTestAuthenticationSession({
        id: "47d079fc-578b-4981-a820-078b75c0176f",
      }),
    );
    initialiseOauthAuthenticationSession.mockResolvedValue(
      createTestAuthenticationSession({
        id: "f6988ae2-8b88-4ccf-adfb-5234f10621a6",
      }),
    );
    initialiseStandardAuthenticationSession.mockResolvedValue(
      createTestAuthenticationSession({
        id: "1365d079-d98b-4c15-b4eb-f961a0c23f21",
      }),
    );
  });

  test("should resolve with session linked to elevation", async () => {
    ctx.data = {
      codeChallenge: "codeChallenge",
      codeChallengeMethod: "codeChallengeMethod",
      elevationSessionId: "47d079fc-578b-4981-a820-078b75c0176f",
    };

    await expect(initialiseAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        id: "47d079fc-578b-4981-a820-078b75c0176f",
      },
    });

    expect(initialiseElevateAuthenticationSession).toHaveBeenCalled();
  });

  test("should resolve with session linked to oauth", async () => {
    ctx.data = {
      codeChallenge: "codeChallenge",
      codeChallengeMethod: "codeChallengeMethod",
      oauthSessionId: "5d420f28-baab-407c-8412-62c0111dd605",
    };

    await expect(initialiseAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        id: "f6988ae2-8b88-4ccf-adfb-5234f10621a6",
      },
    });

    expect(initialiseOauthAuthenticationSession).toHaveBeenCalled();
  });

  test("should resolve with standard session", async () => {
    ctx.data = {
      clientId: "5a30f38c-bfcb-4bd3-a76f-6fdce87e7a82",
      codeChallenge: "codeChallenge",
      codeChallengeMethod: "codeChallengeMethod",
      country: "se",
      identityId: "71781faf-5195-4cd9-8200-5a54b9ddcdc6",
      levelOfAssurance: 4,
      methods: ["email"],
      nonce: "nonce",
    };

    await expect(initialiseAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        id: "1365d079-d98b-4c15-b4eb-f961a0c23f21",
      },
    });

    expect(initialiseStandardAuthenticationSession).toHaveBeenCalled();
  });
});
