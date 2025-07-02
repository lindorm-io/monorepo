import { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import z from "zod";
import {
  CorrelationField,
  DelayField,
  Field,
  IdentifierField,
  MandatoryField,
  Message,
  OnConsume,
  OnCreate,
  OnPublish,
  OnValidate,
  PersistentField,
  PriorityField,
  Schema,
  TimestampField,
} from "../decorators";
import { defaultCreateMessage } from "./default-create-message";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
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

describe("defaultCreateMessage", () => {
  enum TestEnum {
    One = "1",
    Two = "2",
  }

  test("should create with empty values", () => {
    @Message()
    @Schema(z.object({}).passthrough())
    @OnCreate((message) => {
      message.OnCreate = "OnCreate";
    })
    @OnConsume((message) => {
      message.OnValidate = "OnValidate";
    })
    @OnPublish((message) => {
      message.OnValidate = "OnValidate";
    })
    @OnValidate((message) => {
      message.OnValidate = "OnValidate";
    })
    class TestCreateMessageEmpty {
      @CorrelationField()
      correlation!: string;

      @DelayField()
      delay!: number;

      @IdentifierField()
      identifier!: string;

      @MandatoryField()
      mandatory!: boolean;

      @PersistentField()
      persistent!: boolean;

      @PriorityField()
      priority!: number;

      @TimestampField()
      timestamp!: Date;

      @Field("array")
      array!: any[];

      @Field("bigint")
      bigint!: bigint;

      @Field("boolean")
      boolean!: boolean;

      @Field("date")
      date!: Date;

      @Field("email")
      email!: string;

      @Field("enum", { enum: TestEnum })
      enum!: TestEnum;

      @Field("float")
      float!: number;

      @Field("integer")
      integer!: number;

      @Field("object")
      object!: Dict;

      @Field("string")
      string!: string;

      @Field("url")
      url!: string;

      @Field("uuid")
      uuid!: string;
    }

    expect(defaultCreateMessage(TestCreateMessageEmpty)).toMatchSnapshot();
  });

  test("should create with fallback values", () => {
    @Message()
    @Schema(z.object({}).passthrough())
    @OnCreate((message) => {
      message.OnCreate = "OnCreate";
    })
    @OnConsume((message) => {
      message.OnValidate = "OnValidate";
    })
    @OnPublish((message) => {
      message.OnValidate = "OnValidate";
    })
    @OnValidate((message) => {
      message.OnValidate = "OnValidate";
    })
    class TestCreateMessageFallback {
      @CorrelationField()
      correlation!: string;

      @DelayField()
      delay!: number;

      @IdentifierField()
      identifier!: string;

      @MandatoryField()
      mandatory!: boolean;

      @PersistentField()
      persistent!: boolean;

      @PriorityField()
      priority!: number;

      @TimestampField()
      timestamp!: Date;

      @Field("array", { fallback: () => [] })
      array!: any[];

      @Field("bigint", { fallback: () => BigInt(0) })
      bigint!: bigint;

      @Field("boolean", { fallback: () => false })
      boolean!: boolean;

      @Field("date", { fallback: () => new Date("2024-01-01T08:00:00.000Z") })
      date!: Date;

      @Field("email", { fallback: () => "ba@fer.af" })
      email!: string;

      @Field("enum", { enum: TestEnum, fallback: () => TestEnum.One })
      enum!: TestEnum;

      @Field("float", { fallback: () => 0.0 })
      float!: number;

      @Field("integer", { fallback: () => 0 })
      integer!: number;

      @Field("object", { fallback: () => ({ object: true }) })
      object!: Dict;

      @Field("string", { fallback: () => "string" })
      string!: string;

      @Field("url", { fallback: () => "https://example.com" })
      url!: string;

      @Field("uuid", { fallback: () => "f264a693-99a3-5cb0-955c-f70fd90e59d4" })
      uuid!: string;
    }

    expect(defaultCreateMessage(TestCreateMessageFallback)).toMatchSnapshot();
  });

  test("should create with options values", () => {
    @Message()
    @Schema(z.object({}).passthrough())
    @OnCreate((message) => {
      message.OnCreate = "OnCreate";
    })
    @OnConsume((message) => {
      message.OnValidate = "OnValidate";
    })
    @OnPublish((message) => {
      message.OnValidate = "OnValidate";
    })
    @OnValidate((message) => {
      message.OnValidate = "OnValidate";
    })
    class TestCreateMessageOptions {
      @CorrelationField()
      correlation!: string;

      @DelayField()
      delay!: number;

      @IdentifierField()
      identifier!: string;

      @MandatoryField()
      mandatory!: boolean;

      @PersistentField()
      persistent!: boolean;

      @PriorityField()
      priority!: number;

      @TimestampField()
      timestamp!: Date;

      @Field("array")
      array!: any[];

      @Field("bigint")
      bigint!: bigint;

      @Field("boolean")
      boolean!: boolean;

      @Field("date")
      date!: Date;

      @Field("email")
      email!: string;

      @Field("enum", { enum: TestEnum })
      enum!: TestEnum;

      @Field("float")
      float!: number;

      @Field("integer")
      integer!: number;

      @Field("object")
      object!: Dict;

      @Field("string")
      string!: string;

      @Field("url")
      url!: string;

      @Field("uuid")
      uuid!: string;
    }

    expect(
      defaultCreateMessage(TestCreateMessageOptions, {
        correlation: "b3f411b3-aafc-5445-b2f4-b761c8dce43e",
        delay: 1234,
        identifier: "9350aeb8-8bb2-57f0-9268-64f955683261",
        mandatory: true,
        persistent: true,
        priority: 999,
        timestamp: new Date("2025-01-01T08:00:00.000Z"),
        array: ["array", "of", "values"],
        bigint: BigInt(1234567890123456789),
        boolean: true,
        date: new Date("2026-01-01T08:00:00.000Z"),
        email: "sus@uco.as",
        enum: TestEnum.Two,
        float: 3.14,
        integer: 42,
        object: { key: "value" },
        string: "x7cyJh9R3w1",
        url: "http://comomzi.kh/iwibavif",
        uuid: "c6263d16-9031-571c-92c1-f62f5dec8286",
      }),
    ).toMatchSnapshot();
  });
});
