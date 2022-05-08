import MockDate from "mockdate";
import { KeyType, NamedCurve } from "../../enum";
import { generateKeyPair } from "./generate-key-pair";
import { generateKeyPair as _cryptoGenerateKeyPair, randomUUID as _randomUUID } from "crypto";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("crypto");

const cryptoGenerateKeyPair = _cryptoGenerateKeyPair as unknown as jest.Mock;
const randomUUID = _randomUUID as unknown as jest.Mock;

describe("generateKeyPair", () => {
  beforeEach(() => {
    cryptoGenerateKeyPair.mockImplementation((_1: never, _2: never, callback: any) =>
      callback(null, "PUBLIC_KEY", "PRIVATE_KEY"),
    );
    randomUUID.mockImplementation(() => "011ca5fd-abf4-4c6f-a349-59df20c48ead");
  });

  afterEach(jest.clearAllMocks);

  test("should generate KeyPair", async () => {
    await expect(generateKeyPair({ type: KeyType.EC })).resolves.toMatchSnapshot();
  });

  test("should generate EC KeyPair", async () => {
    await expect(generateKeyPair({ type: KeyType.EC })).resolves.toMatchSnapshot();
  });

  test("should generate EC KeyPair with namedCurve", async () => {
    await expect(
      generateKeyPair({ namedCurve: NamedCurve.P384, type: KeyType.EC }),
    ).resolves.toMatchSnapshot();
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
