import MockDate from "mockdate";
import { getAdjustedAccessLevel } from "./get-adjusted-access-level";
import { createTestClientSession } from "../fixtures/entity";

describe("getAdjustedAccessLevel", () => {
  test("should not adjust", () => {
    MockDate.set("2021-01-01T08:00:00.001Z");

    expect(
      getAdjustedAccessLevel(
        createTestClientSession({
          levelOfAssurance: 4,
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        }),
      ),
    ).toBe(4);
  });

  test("should adjust down to 3", () => {
    MockDate.set("2021-01-02T08:00:00.001Z");

    expect(
      getAdjustedAccessLevel(
        createTestClientSession({
          levelOfAssurance: 4,
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        }),
      ),
    ).toBe(3);
  });

  test("should adjust down to 2", () => {
    MockDate.set("2021-01-08T08:00:00.001Z");

    expect(
      getAdjustedAccessLevel(
        createTestClientSession({
          levelOfAssurance: 4,
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        }),
      ),
    ).toBe(2);
  });

  test("should adjust down to 1", () => {
    MockDate.set("2021-01-31T08:00:00.001Z");

    expect(
      getAdjustedAccessLevel(
        createTestClientSession({
          levelOfAssurance: 4,
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        }),
      ),
    ).toBe(1);
  });

  test("should adjust down to 0", () => {
    MockDate.set("2021-04-01T08:00:00.001Z");

    expect(
      getAdjustedAccessLevel(
        createTestClientSession({
          levelOfAssurance: 4,
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        }),
      ),
    ).toBe(0);
  });
});
