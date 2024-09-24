import MockDate from "mockdate";
import { expires } from "./expires";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("expiryObject", () => {
  test("should resolve", () => {
    expect(expires("10 minutes")).toEqual({
      expiresAt: new Date("2024-01-01T08:10:00.000Z"),
      expiresIn: 600,
      expiresOn: 1704096600,
      from: new Date("2024-01-01T08:00:00.000Z"),
      fromUnix: 1704096000,
    });
  });
});
