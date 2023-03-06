import MockDate from "mockdate";
import { createMockRepository } from "@lindorm-io/mongo";
import { tokenExchangeController } from "./exchange";
import {
  convertOpaqueTokenToJwt as _convertOpaqueTokenToJwt,
  resolveTokenSession as _resolveTokenSession,
} from "../../handler";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const convertOpaqueTokenToJwt = _convertOpaqueTokenToJwt as jest.Mock;
const resolveTokenSession = _resolveTokenSession as jest.Mock;

describe("introspectController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        token: "token",
      },
      repository: {
        clientRepository: createMockRepository(createTestClient),
        clientSessionRepository: createMockRepository(createTestClientSession),
      },
    };

    convertOpaqueTokenToJwt.mockImplementation(() => ({ token: "jwt.jwt.jwt", expiresIn: 999 }));
    resolveTokenSession.mockResolvedValue(createTestAccessToken());
  });

  test("should resolve token info", async () => {
    await expect(tokenExchangeController(ctx)).resolves.toStrictEqual({
      body: { jwt: "jwt.jwt.jwt", expiresIn: 999 },
    });
  });
});
