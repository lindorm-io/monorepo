import { ClientError } from "@lindorm/errors";
import MockDate from "mockdate";
import { parseTokenData } from "./parse-token-data";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockImplementation(() => "c8ff3952-8ba4-51a3-a4d5-2f0726c49524"),
}));

const isJwt = jest.fn().mockReturnValue(true);
jest.mock("@lindorm/aegis", () => ({
  Aegis: class Aegis {
    static parse() {
      return {
        payload: {
          expiresAt: new Date(Date.now() + 86400 * 1000),
          issuedAt: new Date(),
          sessionId: "85924874-c05c-5574-ad85-0cf2cf39be95",
          subject: "4e294800-be7e-5954-b143-0ebdcf393906",
        },
      };
    }
    static isJwt() {
      return isJwt();
    }
  },
}));

describe("parseTokenData", () => {
  let ctx: any;
  let config: any;
  let data: any;

  beforeEach(() => {
    ctx = {
      state: {
        session: undefined,
      },
    };

    config = {
      tokenExpiry: "1h",
    };

    data = {
      accessToken: "accessToken",
      code: "code",
      expiresIn: 3600,
      expiresOn: Math.floor(Date.now() / 1000) + 3600,
      idToken: "idToken",
      refreshToken: "refreshToken",
      scope: "scope1 scope2",
      state: "state",
      tokenType: "Bearer",
    };
  });

  afterEach(jest.clearAllMocks);

  test("should parse access token correctly", () => {
    data.idToken = undefined;
    data.refreshToken = undefined;

    expect(parseTokenData(ctx, config, data)).toMatchSnapshot();
  });

  test("should not parse access token if not jwt", () => {
    data.idToken = undefined;
    data.refreshToken = undefined;

    isJwt.mockReturnValue(false);

    expect(parseTokenData(ctx, config, data)).toMatchSnapshot();
  });

  test("should parse id token correctly", () => {
    data.refreshToken = undefined;

    expect(parseTokenData(ctx, config, data)).toMatchSnapshot();
  });

  test("should parse all tokens correctly", () => {
    expect(parseTokenData(ctx, config, data)).toMatchSnapshot();
  });

  test("should parse when session exists", () => {
    ctx.state.session = {
      id: "35e8805b-2352-5c71-871a-19e8545540ce",
      accessToken: "existingAccessToken",
      expiresAt: Date.now() + 4800 * 1000,
      idToken: "existingIdToken",
      issuedAt: Date.now() - 360 * 1000,
      refreshToken: "existingRefreshToken",
      scope: ["scope1", "scope2"],
      subject: "efd9178b-778b-53ce-b929-da87c320140e",
    };

    data = {
      accessToken: "accessToken",
    };

    isJwt.mockReturnValue(false);

    expect(parseTokenData(ctx, config, data)).toMatchSnapshot();
  });

  test("should throw on missing access token", () => {
    data.accessToken = undefined;

    expect(() => parseTokenData(ctx, config, data)).toThrow(ClientError);
  });
});
