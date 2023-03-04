import MockDate from "mockdate";
import { createMockRepository } from "@lindorm-io/mongo";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../../util";
import { resolveTokenSession as _resolveTokenSession } from "../../handler";
import { tokenIntrospectController } from "./introspect";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;
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

    getAdjustedAccessLevel.mockImplementation(() => 1);
    resolveTokenSession.mockResolvedValue(
      createTestAccessToken({
        id: "b82a1243-e25d-47f3-9fbd-35c15de54cd0",
      }),
    );
  });

  test("should resolve token info", async () => {
    ctx.repository.clientRepository.find.mockResolvedValue(
      createTestClient({
        id: "85719f0b-2f8b-478a-86c1-6586843c490b",
        tenantId: "d1b90ac7-69a6-4187-92f2-46e9dceccde9",
      }),
    );
    ctx.repository.clientSessionRepository.find.mockResolvedValue(
      createTestClientSession({
        id: "261b653d-2849-4a8a-a6d4-9a2b716b179f",
        audiences: ["d32b8874-d32f-4280-94e5-d7df74c446ae"],
        identityId: "158a4f7c-8e62-4bfd-94a3-be34f88a4fe6",
      }),
    );

    await expect(tokenIntrospectController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        aal: 1,
        acr: "loa_2",
        amr: ["email", "phone"],
        aud: [
          "6ea68f3d-e31e-4882-85a5-0a617f431fdd",
          "85719f0b-2f8b-478a-86c1-6586843c490b",
          "9993fa84-bedf-4a93-a421-1f63719cd9d3",
          "d32b8874-d32f-4280-94e5-d7df74c446ae",
          "f39e83c0-10d8-49a1-8ecb-bb89f1d57b7f",
        ],
        authTime: 1609487940,
        azp: "85719f0b-2f8b-478a-86c1-6586843c490b",
        clientId: "85719f0b-2f8b-478a-86c1-6586843c490b",
        exp: 1609574400,
        iat: 1609488000,
        iss: "https://oauth.test.lindorm.io",
        jti: "b82a1243-e25d-47f3-9fbd-35c15de54cd0",
        loa: 2,
        nbf: 1609488000,
        scope: "openid profile",
        sid: "261b653d-2849-4a8a-a6d4-9a2b716b179f",
        sub: "158a4f7c-8e62-4bfd-94a3-be34f88a4fe6",
        tid: "d1b90ac7-69a6-4187-92f2-46e9dceccde9",
        tokenType: "access_token",
        username: "158a4f7c-8e62-4bfd-94a3-be34f88a4fe6",
      },
    });
  });

  test("should resolve empty info on error", async () => {
    ctx.repository.clientSessionRepository.find.mockRejectedValue(new Error("message"));

    await expect(tokenIntrospectController(ctx)).resolves.toStrictEqual({
      body: {
        active: false,
        aal: 0,
        acr: null,
        amr: [],
        aud: [],
        authTime: 0,
        azp: null,
        clientId: null,
        exp: 0,
        iat: 0,
        iss: null,
        jti: null,
        loa: 0,
        nbf: 0,
        scope: null,
        sid: null,
        sub: null,
        tid: null,
        tokenType: null,
        username: null,
      },
    });
  });
});
