import MockDate from "mockdate";
import { AuthenticationStrategy } from "../../enum";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession, createTestStrategySession } from "../../fixtures/entity";
import { findStrategyConfig as _findStrategyConfig } from "../../util";
import { initialiseStrategyController } from "./initialise-strategy";
import {
  initialiseRdcQrCode as _initialiseRdcQrCode,
  initialiseSessionAcceptWithCode as _initialiseSessionAcceptWithCode,
} from "../../handler";

MockDate.set("2022-01-01T07:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const findStrategyConfig = _findStrategyConfig as jest.Mock;
const initialiseRdcQrCode = _initialiseRdcQrCode as jest.Mock;
const initialiseSessionAcceptWithCode = _initialiseSessionAcceptWithCode as jest.Mock;

describe("initialiseStrategyController", () => {
  let ctx: any;

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
        strategy: AuthenticationStrategy.DEVICE_CHALLENGE,
        username: "username",
      },
      entity: {
        authenticationSession: createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategy),
        }),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({ token: "jwt.jwt.jwt" })),
      },
    };

    findStrategyConfig.mockImplementation((name) => ({
      name,
      confirmKey: "confirm_key",
      pollingRequired: true,
      tokenReturn: true,
    }));
    initialiseRdcQrCode.mockResolvedValue({ qrCode: "QR_CODE" });
    initialiseSessionAcceptWithCode.mockResolvedValue({ displayCode: "DISPLAY_CODE" });
  });

  test("should resolve", async () => {
    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        confirmKey: "confirm_key",
        strategySessionToken: "jwt.jwt.jwt",
        expiresIn: 3006,
        pollingRequired: true,
      },
    });

    expect(ctx.cache.strategySessionCache.create).toHaveBeenCalled();
  });

  test("should resolve qr code", async () => {
    ctx.data.strategy = AuthenticationStrategy.RDC_QR_CODE;

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        confirmKey: "confirm_key",
        strategySessionToken: "jwt.jwt.jwt",
        expiresIn: 3006,
        pollingRequired: true,
        qrCode: "QR_CODE",
      },
    });
  });

  test("should resolve display code", async () => {
    ctx.data.strategy = AuthenticationStrategy.SESSION_ACCEPT_WITH_CODE;

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        confirmKey: "confirm_key",
        strategySessionToken: "jwt.jwt.jwt",
        expiresIn: 3006,
        pollingRequired: true,
        displayCode: "DISPLAY_CODE",
      },
    });
  });

  test("should resolve without token", async () => {
    findStrategyConfig.mockImplementation((name) => ({
      name,
      confirmKey: "confirm_key",
      pollingRequired: true,
      tokenReturn: false,
    }));

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        confirmKey: "confirm_key",
        strategySessionToken: null,
        expiresIn: 3006,
        pollingRequired: true,
      },
    });
  });

  test("should resolve without polling", async () => {
    findStrategyConfig.mockImplementation((name) => ({
      name,
      confirmKey: "confirm_key",
      pollingRequired: false,
      tokenReturn: true,
    }));

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        confirmKey: "confirm_key",
        strategySessionToken: "jwt.jwt.jwt",
        expiresIn: 3006,
        pollingRequired: false,
      },
    });
  });
});
