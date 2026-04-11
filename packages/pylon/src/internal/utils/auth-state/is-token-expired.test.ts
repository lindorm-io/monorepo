import { isTokenExpired } from "./is-token-expired";

describe("isTokenExpired", () => {
  const now = new Date("2026-04-11T12:00:00.000Z");

  test("returns false when now is well before exp", () => {
    expect(isTokenExpired(new Date("2026-04-11T12:05:00.000Z"), now)).toMatchSnapshot();
  });

  test("returns true when now equals exp", () => {
    expect(isTokenExpired(new Date("2026-04-11T12:00:00.000Z"), now)).toMatchSnapshot();
  });

  test("returns true when now is past exp", () => {
    expect(isTokenExpired(new Date("2026-04-11T11:59:59.000Z"), now)).toMatchSnapshot();
  });
});
