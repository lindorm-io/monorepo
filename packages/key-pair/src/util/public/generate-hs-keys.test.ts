import { randomUnreserved as _randomUnreserved } from "@lindorm-io/random";
import { generateHsKeys } from "./generate-hs-keys";

jest.mock("@lindorm-io/random");

const randomUnreserved = _randomUnreserved as jest.Mock;

describe("generateHsKeys", () => {
  beforeEach(() => {
    randomUnreserved.mockReturnValue(
      "w(Hr~(~DwknfWryBEsAmJwO0*5Urs_10vsL2dllJdTVc.C3j_fF36a-Xsji.8g*)w(9j0C-2rlp2fCXsK1fxA_).*6NG70vloV3h)*do0!T44PB7099S21y7~2--h5)~",
    );
  });

  test("should resolve", async () => {
    expect(generateHsKeys()).toMatchSnapshot();
  });
});
