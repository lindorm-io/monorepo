import MockDate from "mockdate";
import { getConsentInfoController } from "./get-consent-info";
import { isConsentRequired as _isConsentRequired } from "../../util";
import {
  getTestAuthorizationSession,
  getTestBrowserSession,
  getTestClient,
  getTestConsentSession,
} from "../../test/entity";
import { logger } from "../../test/logger";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const isConsentRequired = _isConsentRequired as jest.Mock;

describe("getConsentInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: {
          update: jest.fn(),
        },
      },
      entity: {
        authorizationSession: getTestAuthorizationSession({
          id: "896f2d7b-2205-42b4-b1c6-ec2ac2d22895",
        }),
        browserSession: getTestBrowserSession({
          id: "baa9910c-06e0-4d8b-a46d-870d8aa90218",
        }),
        client: getTestClient({
          id: "a8fbad57-e43a-4e05-b4c8-7607348bd5b7",
        }),
      },
      logger,
      repository: {
        consentSessionRepository: {
          findOrCreate: jest.fn().mockResolvedValue(
            getTestConsentSession({
              id: "e53fb80d-9bcd-4cb7-aa0c-7b365ef2578f",
            }),
          ),
        },
      },
    };

    isConsentRequired.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    await expect(getConsentInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
