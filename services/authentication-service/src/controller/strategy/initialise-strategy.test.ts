import MockDate from "mockdate";
import { AuthenticationMethod } from "../../enum";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession, createTestStrategySession } from "../../fixtures/entity";
import { initialiseStrategyController } from "./initialise-strategy";
import { findMethodConfiguration as _findMethodConfiguration } from "../../util";
import {
  initialiseRdcQrCode as _initialiseRdcQrCode,
  initialiseSessionAcceptWithCode as _initialiseSessionAcceptWithCode,
} from "../../handler";

MockDate.set("2022-01-01T07:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const findMethodConfiguration = _findMethodConfiguration as jest.Mock;
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
        method: AuthenticationMethod.DEVICE_CHALLENGE,
        username: "username",
      },
      entity: {
        authenticationSession: createTestAuthenticationSession(),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({ token: "jwt.jwt.jwt" })),
      },
    };

    findMethodConfiguration.mockImplementation((name) => ({
      name,
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
        strategySessionToken: "jwt.jwt.jwt",
        expiresIn: 3600,
        pollingRequired: true,
      },
    });

    expect(ctx.cache.strategySessionCache.create).toHaveBeenCalled();
  });

  test("should resolve qr code", async () => {
    ctx.data.method = AuthenticationMethod.RDC_QR_CODE;

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        strategySessionToken: "jwt.jwt.jwt",
        expiresIn: 3600,
        pollingRequired: true,
        qrCode: "QR_CODE",
      },
    });
  });

  test("should resolve display code", async () => {
    ctx.data.method = AuthenticationMethod.SESSION_ACCEPT_WITH_CODE;

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        strategySessionToken: "jwt.jwt.jwt",
        expiresIn: 3600,
        pollingRequired: true,
        displayCode: "DISPLAY_CODE",
      },
    });
  });

  test("should resolve without token", async () => {
    findMethodConfiguration.mockImplementation((name) => ({
      name,
      pollingRequired: true,
      tokenReturn: false,
    }));

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        strategySessionToken: null,
        expiresIn: 3600,
        pollingRequired: true,
      },
    });
  });

  test("should resolve without polling", async () => {
    findMethodConfiguration.mockImplementation((name) => ({
      name,
      pollingRequired: false,
      tokenReturn: true,
    }));

    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        id: expect.any(String),
        strategySessionToken: "jwt.jwt.jwt",
        expiresIn: 3600,
        pollingRequired: false,
      },
    });
  });
});
