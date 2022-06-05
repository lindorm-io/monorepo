import MockDate from "mockdate";
import { createMockCache } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockRepository } from "@lindorm-io/mongo";
import { getConsentInfoController } from "./get-consent-info";
import { isConsentRequired as _isConsentRequired } from "../../util";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const isConsentRequired = _isConsentRequired as jest.Mock;

describe("getConsentInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      entity: {
        authorizationSession: createTestAuthorizationSession({
          id: "896f2d7b-2205-42b4-b1c6-ec2ac2d22895",
        }),
        browserSession: createTestBrowserSession({
          id: "baa9910c-06e0-4d8b-a46d-870d8aa90218",
        }),
        client: createTestClient({
          id: "a8fbad57-e43a-4e05-b4c8-7607348bd5b7",
        }),
      },
      logger: createMockLogger(),
      repository: {
        consentSessionRepository: createMockRepository(createTestConsentSession),
      },
    };

    isConsentRequired.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    await expect(getConsentInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
