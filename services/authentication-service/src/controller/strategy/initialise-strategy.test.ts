import MockDate from "mockdate";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession, createTestStrategySession } from "../../fixtures/entity";
import { findStrategyConfig as _findStrategyConfig } from "../../util";
import { initialiseStrategyController } from "./initialise-strategy";
import {
  initialiseRdcQrCode as _initialiseRdcQrCode,
  initialiseSessionAcceptWithCode as _initialiseSessionAcceptWithCode,
} from "../../handler";
import { AuthenticationStrategies } from "@lindorm-io/common-types";

MockDate.set("2022-01-01T07:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const findStrategyConfig = _findStrategyConfig as jest.Mock;
const initialiseRdcQrCode = _initialiseRdcQrCode as jest.Mock;
const initialiseSessionAcceptWithCode = _initialiseSessionAcceptWithCode as jest.Mock;

describe("initialiseStrategyController", () => {
  let ctx: any;
  let config: any;

  beforeEach(() => {
    ctx = {
      cache: {
        strategySessionCache: createMockCache(createTestStrategySession),
      },
      data: {
        email: "email",
        nin: "nin",
        nonce: "nonce",
        phoneNumber: "phoneNumber",
        strategy: "device_challenge",
        username: "username",
      },
      entity: {
        authenticationSession: createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategies),
        }),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({ token: "jwt.jwt.jwt" })),
      },
    };

    config = {
      method: "device_link",
      strategy: "device_challenge",
      amrValuesMax: 0,
      amrValuesMin: 0,
      hint: "none",
      initialiseKey: "none",
      confirmKey: "challenge_confirmation_token",
      confirmLength: 99,
      confirmMode: "none",
      mfaCookie: true,
      pollingRequired: true,
      tokenReturn: true,
      value: 3,
      valueMax: 3,
      weight: 90,
    };

    findStrategyConfig.mockImplementation(() => config);
    initialiseRdcQrCode.mockResolvedValue({ qrCode: "QR_CODE" });
    initialiseSessionAcceptWithCode.mockResolvedValue({ displayCode: "DISPLAY_CODE" });
  });

  test("should resolve", async () => {
    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        displayCode: null,
        expiresIn: 3600,
        id: expect.any(String),
        inputKey: "challenge_confirmation_token",
        inputLength: 99,
        inputMode: "none",
        pollingRequired: true,
        qrCode: null,
        strategySessionToken: "jwt.jwt.jwt",
      },
    });

    expect(ctx.cache.strategySessionCache.create).toHaveBeenCalled();
  });

  test("should resolve qr code", async () => {
    ctx.data.strategy = "rdc_qr_code";

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        expiresIn: 3600,
        inputKey: "challenge_confirmation_token",
        inputLength: 99,
        inputMode: "none",
        pollingRequired: true,
        qrCode: "QR_CODE",
        strategySessionToken: "jwt.jwt.jwt",
      },
    });
  });

  test("should resolve display code", async () => {
    ctx.data.strategy = "session_accept_with_code";

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        displayCode: "DISPLAY_CODE",
        expiresIn: 3600,
        inputKey: "challenge_confirmation_token",
        inputLength: 99,
        inputMode: "none",
        pollingRequired: true,
        strategySessionToken: "jwt.jwt.jwt",
      },
    });
  });

  test("should resolve without token", async () => {
    config.tokenReturn = false;

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        displayCode: null,
        expiresIn: 3600,
        inputKey: "challenge_confirmation_token",
        inputLength: 99,
        inputMode: "none",
        pollingRequired: true,
        qrCode: null,
        strategySessionToken: null,
      },
    });
  });

  test("should resolve without polling", async () => {
    config.pollingRequired = false;

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        displayCode: null,
        expiresIn: 3600,
        inputKey: "challenge_confirmation_token",
        inputLength: 99,
        inputMode: "none",
        pollingRequired: false,
        qrCode: null,
        strategySessionToken: "jwt.jwt.jwt",
      },
    });
  });
});
