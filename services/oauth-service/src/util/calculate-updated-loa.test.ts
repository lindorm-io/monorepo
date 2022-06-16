import { calculateUpdatedLoa } from "./calculate-updated-loa";
import { createTestBrowserSession } from "../fixtures/entity";
import { getAdjustedAccessLevel as _getAdjustedAccessLevel } from "./get-adjusted-access-level";

jest.mock("./get-adjusted-access-level");

const getAdjustedAccessLevel = _getAdjustedAccessLevel as jest.Mock;

describe("calculateUpdatedLoa", () => {
  let session: any;
  let token: any;

  beforeEach(() => {
    session = createTestBrowserSession({ levelOfAssurance: 3 });

    token = {
      claims: { maximumLoa: 0 },
      levelOfAssurance: 0,
    };

    getAdjustedAccessLevel.mockImplementation(() => 1);
  });

  test("should resolve when token loa is higher than session loa", () => {
    token.claims.maximumLoa = 4;
    token.levelOfAssurance = 4;

    expect(calculateUpdatedLoa(session, token)).toBe(4);
  });

  test("should resolve with calculated loa", () => {
    token.claims.maximumLoa = 3;
    token.levelOfAssurance = 2;

    expect(calculateUpdatedLoa(session, token)).toBe(3);
  });

  test("should resolve with loa", () => {
    getAdjustedAccessLevel.mockImplementation(() => 0);

    token.claims.maximumLoa = 3;
    token.levelOfAssurance = 2;

    expect(calculateUpdatedLoa(session, token)).toBe(2);
  });

  test("should resolve with maximum loa", () => {
    token.claims.maximumLoa = 2;
    token.levelOfAssurance = 2;

    expect(calculateUpdatedLoa(session, token)).toBe(2);
  });
});
