import { AuthorizationSession, BrowserSession, Client, ConsentSession } from "../../entity";
import { ResponseMode, ResponseType } from "../../common";
import { TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import { baseHash } from "@lindorm-io/core";
import { createAccessToken as _createAccessToken, createIdToken as _createIdToken } from "../token";
import { generateAuthorizationCode as _generateAuthorizationCode } from "./generate-authorization-code";
import { generateCallbackResponse } from "./generate-callback-response";
import { getIdentityUserinfo as _getIdentityUserinfo } from "../identity";
import {
  createTestAuthorizationCode,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
} from "../../fixtures/entity";

jest.mock("../identity");
jest.mock("../token");
jest.mock("./generate-authorization-code");

const createAccessToken = _createAccessToken as jest.Mock;
const createIdToken = _createIdToken as jest.Mock;
const getIdentityUserinfo = _getIdentityUserinfo as jest.Mock;
const generateAuthorizationCode = _generateAuthorizationCode as jest.Mock;

describe("generateCallbackResponse", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;
  let consentSession: ConsentSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      cookies: {
        set: jest.fn(),
      },
    };

    authorizationSession = createTestAuthorizationSession();
    browserSession = createTestBrowserSession();
    consentSession = createTestConsentSession();
    client = createTestClient();

    createAccessToken.mockImplementation(() => ({
      token: "access.token.jwt",
      expiresIn: 999,
    }));
    createIdToken.mockImplementation(() => ({
      token: "id.token.jwt",
      expiresIn: 999,
    }));
    getIdentityUserinfo.mockResolvedValue(TEST_GET_USERINFO_RESPONSE);
    generateAuthorizationCode.mockResolvedValue(
      createTestAuthorizationCode({
        code: "vDQr4zWZxFpINepNGVialEo7yMnEoyJKcEDeMmtS0kHJ08nBqaLaljulOmjzmhhY",
      }),
    );
  });

  afterEach(jest.resetAllMocks);

  test("should resolve state on form post", async () => {
    authorizationSession = createTestAuthorizationSession({
      responseMode: ResponseMode.FORM_POST,
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, consentSession, client),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect",
      body: {
        redirectData:
          "ZXlKemRISnBibWNpT2lKemRISnBibWNpTENKdWRXMWlaWElpT2pFeU15d2lZbTl2YkdWaGJpSTZkSEoxWlgwPQ==",
        state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      },
    });
  });

  test("should resolve callback uri on fragment", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseMode: ResponseMode.FRAGMENT,
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, consentSession, client),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect#state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });
  });

  test("should resolve callback uri on query", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseMode: ResponseMode.QUERY,
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, consentSession, client),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect?state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });
  });

  test("should resolve callback uri with code", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseTypes: [ResponseType.CODE],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, consentSession, client),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "code=vDQr4zWZxFpINepNGVialEo7yMnEoyJKcEDeMmtS0kHJ08nBqaLaljulOmjzmhhY",
      ),
    });
  });

  test("should resolve callback uri with access token", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseTypes: [ResponseType.TOKEN],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, consentSession, client),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "access_token=access.token.jwt&expires_in=999&token_type=Bearer",
      ),
    });
  });

  test("should resolve callback uri with id token", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: null,
      responseTypes: [ResponseType.ID_TOKEN],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, consentSession, client),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining("id_token=id.token.jwt"),
    });
  });

  test("should resolve callback uri with redirect data", async () => {
    authorizationSession = createTestAuthorizationSession({
      redirectData: baseHash(
        baseHash(JSON.stringify({ string: "string", number: 123, boolean: true })),
      ),
      responseMode: ResponseMode.QUERY,
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, consentSession, client),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "redirect_data=ZXlKemRISnBibWNpT2lKemRISnBibWNpTENKdWRXMWlaWElpT2pFeU15d2lZbTl2YkdWaGJpSTZkSEoxWlgwPQ%3D%3D",
      ),
    });
  });
});
