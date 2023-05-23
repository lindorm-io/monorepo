import { OpenIdResponseMode, OpenIdResponseType } from "@lindorm-io/common-types";
import { baseHash } from "@lindorm-io/core";
import { createOpaqueToken as _createOpaqueToken } from "@lindorm-io/jwt";
import MockDate from "mockdate";
import { AuthorizationRequest, Client, ClientSession } from "../../entity";
import { TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import {
  createTestAccessToken,
  createTestAuthorizationRequest,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { getIdentityClaims as _getIdentityUserinfo } from "../identity";
import {
  convertOpaqueTokenToJwt as _convertOpaqueTokenToJwt,
  createIdToken as _createIdToken,
  generateAccessToken as _generateAccessToken,
} from "../token";
import { generateAuthorizationCode as _generateAuthorizationCode } from "./generate-authorization-code";
import { generateCallbackResponse } from "./generate-callback-response";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/jwt");
jest.mock("../identity");
jest.mock("../token");
jest.mock("./generate-authorization-code");

const createOpaqueToken = _createOpaqueToken as jest.Mock;
const convertOpaqueTokenToJwt = _convertOpaqueTokenToJwt as jest.Mock;
const createIdToken = _createIdToken as jest.Mock;
const generateAccessToken = _generateAccessToken as jest.Mock;
const generateAuthorizationCode = _generateAuthorizationCode as jest.Mock;
const getIdentityUserinfo = _getIdentityUserinfo as jest.Mock;

describe("generateCallbackResponse", () => {
  let ctx: any;
  let authorizationRequest: AuthorizationRequest;
  let clientSession: ClientSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      cookies: {
        set: jest.fn(),
      },
    };

    authorizationRequest = createTestAuthorizationRequest({
      redirectData: null,
      responseTypes: [OpenIdResponseType.TOKEN],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    clientSession = createTestClientSession();
    client = createTestClient();

    createOpaqueToken.mockReturnValue({ token: "create_opaque_token" });
    convertOpaqueTokenToJwt.mockImplementation(() => ({
      token: "access.token.jwt",
    }));
    createIdToken.mockImplementation(() => ({
      token: "id.token.jwt",
    }));
    generateAccessToken.mockResolvedValue(createTestAccessToken());
    getIdentityUserinfo.mockResolvedValue(TEST_GET_USERINFO_RESPONSE);
    generateAuthorizationCode.mockResolvedValue(
      "vDQr4zWZxFpINepNGVialEo7yMnEoyJKcEDeMmtS0kHJ08nBqaLaljulOmjzmhhY",
    );
  });

  afterEach(jest.resetAllMocks);

  test("should resolve form post", async () => {
    authorizationRequest = createTestAuthorizationRequest({
      responseMode: OpenIdResponseMode.FORM_POST,
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationRequest, client, clientSession),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect",
      body: {
        redirectData:
          "ZXlKemRISnBibWNpT2lKemRISnBibWNpTENKdWRXMWlaWElpT2pFeU15d2lZbTl2YkdWaGJpSTZkSEoxWlgwPQ==",
        state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      },
    });
  });

  test("should resolve fragment", async () => {
    authorizationRequest = createTestAuthorizationRequest({
      redirectData: null,
      responseMode: OpenIdResponseMode.FRAGMENT,
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationRequest, client, clientSession),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect#state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });
  });

  test("should resolve query", async () => {
    authorizationRequest = createTestAuthorizationRequest({
      redirectData: null,
      responseMode: OpenIdResponseMode.QUERY,
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationRequest, client, clientSession),
    ).resolves.toStrictEqual({
      redirect: "https://test.client.lindorm.io/redirect?state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });
  });

  test("should resolve with code", async () => {
    authorizationRequest = createTestAuthorizationRequest({
      redirectData: null,
      responseTypes: [OpenIdResponseType.CODE],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationRequest, client, clientSession),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "code=vDQr4zWZxFpINepNGVialEo7yMnEoyJKcEDeMmtS0kHJ08nBqaLaljulOmjzmhhY",
      ),
    });
  });

  test("should resolve with access token", async () => {
    authorizationRequest = createTestAuthorizationRequest({
      redirectData: null,
      responseTypes: [OpenIdResponseType.TOKEN],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationRequest, client, clientSession),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "access_token=access.token.jwt&expires_in=86400&token_type=Bearer",
      ),
    });
  });

  test("should resolve with id token", async () => {
    authorizationRequest = createTestAuthorizationRequest({
      redirectData: null,
      responseTypes: [OpenIdResponseType.ID_TOKEN],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationRequest, client, clientSession),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining("id_token=id.token.jwt"),
    });
  });

  test("should resolve with redirect data", async () => {
    authorizationRequest = createTestAuthorizationRequest({
      redirectData: baseHash(
        baseHash(JSON.stringify({ string: "string", number: 123, boolean: true })),
      ),
      responseMode: OpenIdResponseMode.QUERY,
      responseTypes: [],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationRequest, client, clientSession),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "redirect_data=ZXlKemRISnBibWNpT2lKemRISnBibWNpTENKdWRXMWlaWElpT2pFeU15d2lZbTl2YkdWaGJpSTZkSEoxWlgwPQ%3D%3D",
      ),
    });
  });

  test("should resolve with opaque access token", async () => {
    client.opaqueAccessToken = true;
    authorizationRequest = createTestAuthorizationRequest({
      redirectData: null,
      responseTypes: [OpenIdResponseType.TOKEN],
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });

    await expect(
      generateCallbackResponse(ctx, authorizationRequest, client, clientSession),
    ).resolves.toStrictEqual({
      redirect: expect.stringContaining(
        "access_token=create_opaque_token&expires_in=86400&token_type=Bearer",
      ),
    });
  });
});
