import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import MockDate from "mockdate";
import { createTestClient, createTestElevationSession } from "../../fixtures/entity";
import { initialiseElevation as _initialiseElevation } from "../../handler";
import {
  assertRedirectUri as _assertRedirectUri,
  createElevationPendingUri as _createElevationPendingUri,
  extractAcrValues as _extractAcrValues,
} from "../../util";
import { initialiseRedirectElevationController } from "./initialise-redirect-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const assertRedirectUri = _assertRedirectUri as jest.Mock;
const createElevationPendingUri = _createElevationPendingUri as jest.Mock;
const extractAcrValues = _extractAcrValues as jest.Mock;
const initialiseElevation = _initialiseElevation as jest.Mock;

describe("initialiseRedirectElevationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        acrValues: "acr values string is mocked",
        authenticationHint: "0701234567",
        country: "dk",
        display: "popup",
        methods: "bank_id_se email phone",
        nonce: "QxEQ4H21R-gslTwr",
        uiLocales: "da-DK en-GB",
      },
      entity: {
        client: createTestClient(),
      },
    };

    assertRedirectUri.mockImplementation();
    createElevationPendingUri.mockReturnValue("createElevationPendingUri");
    extractAcrValues.mockReturnValue({
      factors: [AuthenticationFactor.PHISHING_RESISTANT],
      levelOfAssurance: 3,
      methods: [AuthenticationMethod.TIME_BASED_OTP],
      strategies: [AuthenticationStrategy.TIME_BASED_OTP],
    });
    initialiseElevation.mockResolvedValue(
      createTestElevationSession({
        id: "24d18e4b-002f-4adf-9563-ba137c9fe60f",
      }),
    );
  });

  test("should resolve", async () => {
    await expect(initialiseRedirectElevationController(ctx)).resolves.toStrictEqual({
      redirect: "createElevationPendingUri",
    });
  });
});
