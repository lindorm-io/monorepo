import MockDate from "mockdate";
import { getIdentitySessionsController } from "./get-identity-sessions";
import {
  createTestAccessSession,
  createTestClient,
  createTestRefreshSession,
  createTestTenant,
} from "../../fixtures/entity";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "../../util";
import { createMockRepository } from "@lindorm-io/mongo";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;

describe("getIdentitySessions", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "identityId",
      },
      repository: {
        accessSessionRepository: {
          findMany: jest.fn().mockResolvedValue([
            createTestAccessSession({
              id: "60e86c52-59ac-44e9-8e3e-d97079346034",
              levelOfAssurance: 1,
            }),
            createTestAccessSession({
              id: "aedea909-4d62-4fe8-8aac-22e712f659d3",
              levelOfAssurance: 2,
            }),
            createTestAccessSession({
              id: "f04405c1-fa40-454a-a3a9-a016d3b4aa17",
              levelOfAssurance: 3,
            }),
            createTestAccessSession({
              id: "10fe070b-e584-4c43-89f8-df40f4a8797a",
              levelOfAssurance: 3,
            }),
            createTestAccessSession({
              id: "1d1b9520-4c24-43bc-bbb0-b7c925771e8f",
              levelOfAssurance: 4,
            }),
            createTestAccessSession({
              id: "df87f057-a560-4476-9927-c25828b7c20c",
              levelOfAssurance: 4,
            }),
          ]),
        },
        clientRepository: createMockRepository(createTestClient),
        refreshSessionRepository: {
          findMany: jest.fn().mockResolvedValue([
            createTestRefreshSession({
              id: "bd672cb2-669c-4519-9ba1-5850e8974e19",
              levelOfAssurance: 1,
            }),
            createTestRefreshSession({
              id: "e1e16e28-28f5-4357-baee-2251e6a746b2",
              levelOfAssurance: 2,
            }),
            createTestRefreshSession({
              id: "abc98c7d-c557-424e-a810-eb2cd138b7df",
              levelOfAssurance: 3,
            }),
            createTestRefreshSession({
              id: "5a0ded8b-3f6e-4b4a-aea5-7ecf5ddbb676",
              levelOfAssurance: 4,
            }),
          ]),
        },
        tenantRepository: createMockRepository(createTestTenant),
      },
    };

    getAdjustedAccessLevel.mockImplementation(() => 1);
  });

  test("should resolve sessions", async () => {
    await expect(getIdentitySessionsController(ctx)).resolves.toMatchSnapshot();
  });
});
