import MockDate from "mockdate";
import { createTestElevationSession } from "../../fixtures/entity";
import { initialiseElevation as _initialiseElevation } from "../../handler";
import { initialisePostElevationController } from "./initialise-post-elevation";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const initialiseElevation = _initialiseElevation as jest.Mock;

describe("initialisePostElevationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        authenticationHint: "0701234567",
        country: "dk",
        display: "popup",
        levelOfAssurance: 4,
        methods: ["phone"],
        nonce: "QxEQ4H21R-gslTwr",
        uiLocales: ["da-DK"],
      },
    };

    initialiseElevation.mockResolvedValue(
      createTestElevationSession({
        id: "24d18e4b-002f-4adf-9563-ba137c9fe60f",
      }),
    );
  });

  test("should resolve", async () => {
    await expect(initialisePostElevationController(ctx)).resolves.toStrictEqual({
      body: { elevationSessionId: "24d18e4b-002f-4adf-9563-ba137c9fe60f" },
    });
  });
});
