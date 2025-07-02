import MockDate from "mockdate";
import { Field, Message } from "../decorators";
import { Generated } from "../decorators/Generated";
import { defaultCreateMessage } from "./default-create-message";
import { defaultGenerateMessage } from "./default-generate-message";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomBytes: jest
    .fn()
    .mockImplementation(() => Buffer.from("c8ff39528ba451a3a4d52f0726c49524", "hex")),
  randomInt: jest.fn().mockImplementation(() => 123456),
  randomUUID: jest
    .fn()
    .mockImplementation(() => "c8ff3952-8ba4-51a3-a4d5-2f0726c49524")
    .mockImplementationOnce(() => "e8edbe03-f52f-56c6-8d98-82e6961329fe")
    .mockImplementationOnce(() => "0c8c31df-f1cc-5381-97fc-31b3714327de")
    .mockImplementationOnce(() => "2dc92d72-9ce3-50c7-b982-59022ec393f1")
    .mockImplementationOnce(() => "88943033-fef1-5ad8-8cf8-4470be80d197")
    .mockImplementationOnce(() => "1d37a07d-4fd6-5913-85eb-2c7d721cf2a9")
    .mockImplementationOnce(() => "5f2976d2-afda-5e28-9c06-3c04865ea8df"),
}));

describe("defaultGenerateMessage", () => {
  test("should generate standard values", () => {
    @Message()
    class TestGenerateMessageOptions {
      @Field()
      @Generated("date")
      date!: Date;

      @Field()
      @Generated("float")
      float!: number;

      @Field()
      @Generated("integer")
      integer!: number;

      @Field()
      @Generated("string")
      string!: string;

      @Field()
      @Generated("uuid")
      uuid!: string;

      @Field()
      @Generated({ strategy: "integer", max: 4, min: 4 })
      special!: string;

      @Field()
      @Generated({ strategy: "string", length: 32 })
      length!: number;
    }

    expect(
      defaultGenerateMessage(
        TestGenerateMessageOptions,
        defaultCreateMessage(TestGenerateMessageOptions),
      ),
    ).toEqual({
      date: new Date("2024-01-01T08:00:00.000Z"),
      float: expect.any(Number),
      integer: 123456,
      length: "yP85UoukUaOk1S8HJsSVJA",
      special: 123456,
      string: "yP85UoukUaOk1S8HJsSVJA",
      uuid: "e8edbe03-f52f-56c6-8d98-82e6961329fe",
    });
  });
});
