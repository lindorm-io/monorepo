import { AuthenticationMethod } from "../../common";
import { ServerError } from "@lindorm-io/errors";
import { assertElevationSession } from "./assert-elevation-session";
import { createTestElevationSession } from "../../fixtures/entity";

describe("assertElevationSession", () => {
  test("should resolve", () => {
    expect(() =>
      assertElevationSession(
        createTestElevationSession({
          confirmedAuthentication: {
            acrValues: ["acr"],
            amrValues: [AuthenticationMethod.PASSWORD],
            latestAuthentication: new Date(),
            levelOfAssurance: 4,
          },
        }),
      ),
    ).not.toThrow();
  });

  test("should throw", () => {
    expect(() =>
      assertElevationSession(
        createTestElevationSession({
          confirmedAuthentication: {
            acrValues: [],
            amrValues: [],
            latestAuthentication: null,
            levelOfAssurance: 0,
          },
        }),
      ),
    ).toThrow(ServerError);
  });
});
