import { randomUnreserved as _randomUnreserved } from "@lindorm-io/random";
import { generateKeyPair as _cryptoGenerateKeyPair, randomUUID as _randomUUID } from "crypto";
import MockDate from "mockdate";
import { KeyType, NamedCurve } from "../../enum";
import { generateKeyPair } from "./generate-key-pair";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("crypto");
jest.mock("@lindorm-io/random");

const randomUnreserved = _randomUnreserved as jest.Mock;

const cryptoGenerateKeyPair = _cryptoGenerateKeyPair as unknown as jest.Mock;
const randomUUID = _randomUUID as unknown as jest.Mock;

describe("generateKeyPair", () => {
  beforeEach(() => {
    cryptoGenerateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(null, "PUBLIC_KEY", "PRIVATE_KEY"),
    );
    randomUUID.mockReturnValue("011ca5fd-abf4-4c6f-a349-59df20c48ead");
    randomUnreserved.mockReturnValue(
      "w(Hr~(~DwknfWryBEsAmJwO0*5Urs_10vsL2dllJdTVc.C3j_fF36a-Xsji.8g*)w(9j0C-2rlp2fCXsK1fxA_).*6NG70vloV3h)*do0!T44PB7099S21y7~2--h5)~",
    );
  });

  afterEach(jest.clearAllMocks);

  test("should generate EC KeyPair", async () => {
    await expect(generateKeyPair({ type: KeyType.EC })).resolves.toMatchSnapshot();
  });

  test("should generate EC KeyPair with namedCurve", async () => {
    await expect(
      generateKeyPair({ namedCurve: NamedCurve.P384, type: KeyType.EC }),
    ).resolves.toMatchSnapshot();
  });

  test("should generate HS KeyPair", async () => {
    await expect(generateKeyPair({ type: KeyType.HS })).resolves.toMatchSnapshot();
  });

  test("should generate RSA KeyPair", async () => {
    await expect(generateKeyPair({ type: KeyType.RSA })).resolves.toMatchSnapshot();
  });

  test("should generate RSA KeyPair with passphrase", async () => {
    await expect(
      generateKeyPair({ passphrase: "pass", type: KeyType.RSA }),
    ).resolves.toMatchSnapshot();
  });
});
