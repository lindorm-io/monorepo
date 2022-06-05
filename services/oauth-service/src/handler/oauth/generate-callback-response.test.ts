import { AuthorizationSession, BrowserSession, Client } from "../../entity";
import { ResponseMode, ResponseType } from "../../common";
import { TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import { createAccessToken as _createAccessToken, createIdToken as _createIdToken } from "../token";
import { generateCallbackResponse } from "./generate-callback-response";
import { getIdentityUserinfo as _getIdentityUserinfo } from "../identity";
import { setAuthorizationCode as _setAuthorizationCode } from "./set-authorization-code";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
} from "../../fixtures/entity";

jest.mock("../identity");
jest.mock("../token");
jest.mock("./set-authorization-code");

const createAccessToken = _createAccessToken as jest.Mock;
const createIdToken = _createIdToken as jest.Mock;
const getIdentityUserinfo = _getIdentityUserinfo as jest.Mock;
const setAuthorizationCode = _setAuthorizationCode as jest.Mock;

describe("generateCallbackResponse", () => {
  let ctx: any;
  let browserSession: BrowserSession;
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    ctx = {};

    browserSession = createTestBrowserSession();

    authorizationSession = createTestAuthorizationSession({ code: null, redirectData: null });

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
    setAuthorizationCode.mockImplementation(async (_, arg) => ({
      ...arg,
      code: "vDQr4zWZxFpINepNGVialEo7yMnEoyJKcEDeMmtS0kHJ08nBqaLaljulOmjzmhhY",
    }));
  });

  afterEach(jest.resetAllMocks);

  test("should resolve state on form post", async () => {
    authorizationSession = createTestAuthorizationSession({
      code: null,
      redirectData: null,
      responseMode: ResponseMode.FORM_POST,
      responseTypes: [],
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, client),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect",
      body: {
        state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      },
    });
  });

  test("should resolve callback uri on fragment", async () => {
    authorizationSession = createTestAuthorizationSession({
      code: null,
      redirectData: null,
      responseMode: ResponseMode.FRAGMENT,
      responseTypes: [],
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, client),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect#state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });
  });

  test("should resolve callback uri on query", async () => {
    authorizationSession = createTestAuthorizationSession({
      code: null,
      redirectData: null,
      responseMode: ResponseMode.QUERY,
      responseTypes: [],
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, client),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect?state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });
  });

  test("should resolve callback uri with code", async () => {
    authorizationSession = createTestAuthorizationSession({
      code: null,
      redirectData: null,
      responseTypes: [ResponseType.CODE],
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, client),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "code=vDQr4zWZxFpINepNGVialEo7yMnEoyJKcEDeMmtS0kHJ08nBqaLaljulOmjzmhhY",
      ),
    });
  });

  test("should resolve callback uri with access token", async () => {
    authorizationSession = createTestAuthorizationSession({
      code: null,
      redirectData: null,
      responseTypes: [ResponseType.TOKEN],
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, client),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "access_token=access.token.jwt&expires_in=999&token_type=Bearer",
      ),
    });
  });

  test("should resolve callback uri with id token", async () => {
    authorizationSession = createTestAuthorizationSession({
      code: null,
      redirectData: null,
      responseTypes: [ResponseType.ID_TOKEN],
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, client),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining("id_token=id.token.jwt"),
    });
  });

  test("should resolve callback uri with redirect data", async () => {
    authorizationSession = createTestAuthorizationSession({
      code: null,
      responseMode: ResponseMode.QUERY,
      responseTypes: [],
    });

    await expect(
      generateCallbackResponse(ctx, authorizationSession, browserSession, client),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "redirect_data=ZXlKemRISnBibWNpT2lKemRISnBibWNpTENKdWRXMWlaWElpT2pFeU15d2lZbTl2YkdWaGJpSTZkSEoxWlgwPQ%3D%3D",
      ),
    });
  });
});
