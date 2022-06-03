import MockDate from "mockdate";
import axios from "axios";
import { Axios } from "../../class";
import { axiosClientCredentialsMiddleware } from "./axios-client-credentials-middleware";
import { createMockLogger } from "@lindorm-io/winston";

MockDate.set("2020-01-01T08:00:00.000Z");

jest.mock("axios");

const request = axios.request as jest.Mock;

describe("axiosClientCredentialsMiddleware", () => {
  let axios: Axios;
  let middleware: any;

  const logger = createMockLogger();

  beforeEach(() => {
    axios = new Axios({
      host: "https://oauth.lindorm.io",
      port: 4000,
      logger,
      middleware: [],
    });

    request.mockImplementation(async (input) => ({
      status: 200,
      statusText: "OK",
      data: {
        accessToken: "jwt.jwt.jwt",
        expiresIn: 900,
        scope: input.data.scope.split(" "),
      },
    }));

    middleware = axiosClientCredentialsMiddleware({
      clientEnvironment: "clientEnvironment",
      clientId: "clientId",
      clientSecret: "clientSecret",
      clientVersion: "clientVersion",
      timeoutAdjustment: 1,
    });
  });

  afterEach(jest.clearAllMocks);

  test("should request and add access token to request header", async () => {
    await expect(
      middleware(axios, ["scope1", "scope2"]).request({
        data: { data: true },
        headers: { headers: true },
        params: { params: true },
      }),
    ).resolves.toStrictEqual({
      data: {
        data: true,
      },
      headers: {
        Authorization: "Bearer jwt.jwt.jwt",
        headers: true,
        "x-client-environment": "clientEnvironment",
        "x-client-id": "clientId",
        "x-client-version": "clientVersion",
      },
      params: {
        params: true,
      },
    });

    expect(request).toHaveBeenCalledWith({
      data: {
        client_id: "clientId",
        client_secret: "clientSecret",
        grant_type: "client_credentials",
        scope: "scope1 scope2",
      },
      headers: {
        "x-client-environment": "clientEnvironment",
        "x-client-id": "clientId",
        "x-client-version": "clientVersion",
      },
      method: "post",
      timeout: 3000,
      url: "https://oauth.lindorm.io:4000/oauth2/token",
    });
  });

  test("should use existing bearer token by default", async () => {
    await middleware(axios, ["scope1", "scope2"]).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    await middleware(axios, ["scope1", "scope2"]).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    expect(request.mock.calls).toMatchSnapshot();
  });

  test("should perform client credentials request when forced", async () => {
    await middleware(axios, ["scope1", "scope2"]).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    await middleware(axios, ["scope1", "scope2"], true).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    expect(request.mock.calls).toMatchSnapshot();
  });

  test("should perform client credentials request on token timeout", async () => {
    await middleware(axios, ["scope1", "scope2"]).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    MockDate.set("2020-01-01T09:00:00.000Z");

    await middleware(axios, ["scope1", "scope2"]).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    MockDate.set("2020-01-01T08:00:00.000Z");

    expect(request.mock.calls).toMatchSnapshot();
  });

  test("should perform client credentials request on differing scope", async () => {
    await middleware(axios, ["scope1", "scope2"]).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    await middleware(axios, ["scope1", "scope2", "scope3"]).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    expect(request.mock.calls).toMatchSnapshot();
  });

  test("should merge scopes from different requests", async () => {
    await middleware(axios, ["scope1", "scope2"]).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    await middleware(axios, ["scope3", "scope4"]).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    await middleware(axios, ["scope1", "scope4"]).request({
      data: { data: true },
      headers: { headers: true },
      params: { params: true },
    });

    expect(request.mock.calls).toMatchSnapshot();
  });
});
