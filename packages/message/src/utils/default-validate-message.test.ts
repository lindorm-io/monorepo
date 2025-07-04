import { Dict } from "@lindorm/types";
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
import { defaultValidateMessage } from "./default-validate-message";

describe("defaultValidateMessage", () => {
  enum TestEnum {
    One = "1",
    Two = "2",
  }

  test("should validate", () => {
    @Message()
    @OnCreate((message) => {
      (message as any).OnCreate = "OnCreate";
    })
    @OnConsume((message) => {
      (message as any).OnValidate = "OnValidate";
    })
    @OnPublish((message) => {
      (message as any).OnValidate = "OnValidate";
    })
    @OnValidate((message) => {
      (message as any).OnValidate = "OnValidate";
    })
    class TestValidationMessage {
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

    expect(() =>
      defaultValidateMessage(
        TestValidationMessage,
        defaultCreateMessage(TestValidationMessage),
      ),
    ).not.toThrow();
  });

  test("should validate with schema", () => {
    @Message()
    @Schema(
      z.object({
        array: z.array(z.any()),
        bigint: z.bigint(),
        boolean: z.boolean(),
        date: z.date(),
        email: z.string().email(),
        enum: z.nativeEnum(TestEnum),
        float: z.number(),
        integer: z.number().int(),
        object: z.record(z.any()),
        string: z.string(),
        url: z.string().url(),
        uuid: z.string().uuid(),
      }),
    )
    class TestSchemaMessage {
      @Field({ fallback: () => [] })
      array!: any[];

      @Field({ fallback: () => BigInt(0) })
      bigint!: bigint;

      @Field({ fallback: () => false })
      boolean!: boolean;

      @Field({ fallback: () => new Date("2024-01-01T08:00:00.000Z") })
      date!: Date;

      @Field({ fallback: () => "ba@fer.af" })
      email!: string;

      @Field({ enum: TestEnum, fallback: () => TestEnum.One })
      enum!: TestEnum;

      @Field({ fallback: () => 0.0 })
      float!: number;

      @Field({ fallback: () => 0 })
      integer!: number;

      @Field({ fallback: () => ({ object: true }) })
      object!: Dict;

      @Field({ fallback: () => "string" })
      string!: string;

      @Field({ fallback: () => "https://example.com" })
      url!: string;

      @Field({ fallback: () => "f264a693-99a3-5cb0-955c-f70fd90e59d4" })
      uuid!: string;
    }

    expect(() =>
      defaultValidateMessage(TestSchemaMessage, defaultCreateMessage(TestSchemaMessage)),
    ).not.toThrow();
  });
});
