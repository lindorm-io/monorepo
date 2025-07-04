import { createMockLogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import {
  CorrelationField,
  DelayField,
  Field,
  Generated,
  IdentifierField,
  MandatoryField,
  Message,
  OnConsume,
  OnCreate,
  OnPublish,
  OnValidate,
  PersistentField,
  PriorityField,
  TimestampField,
} from "../decorators";
import { MessageKit } from "./MessageKit";

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

describe("MessageKit", () => {
  let kit: MessageKit<TestMessageKit>;

  enum TestEnum {
    One = "1",
    Two = "2",
  }

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
  class TestMessageKit {
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

    @Field("date")
    @Generated("date")
    generated_date!: Date;

    @Field("integer")
    @Generated("integer")
    generated_integer!: number;

    @Field("string")
    @Generated("string")
    generated_string!: string;

    @Field("uuid")
    @Generated("uuid")
    generated_uuid!: string;

    @Field("integer")
    @Generated({ strategy: "integer", max: 4, min: 4 })
    generated_special!: number;

    @Field()
    @Generated({ strategy: "string", length: 32 })
    generated_length!: number;
  }

  beforeEach(() => {
    kit = new MessageKit({
      Message: TestMessageKit,
      logger: createMockLogger(),
    });
  });

  test("should calculate message", () => {
    expect(kit.metadata).toMatchSnapshot();
  });

  test("should resolve create", () => {
    expect(kit.create()).toMatchSnapshot();
  });

  test("should resolve copy", () => {
    expect(kit.copy(kit.create())).toMatchSnapshot();
  });

  test("should resolve publish", () => {
    expect(kit.publish(kit.create())).toMatchSnapshot();
  });

  test("should resolve validate", () => {
    expect(kit.validate(kit.create())).toMatchSnapshot();
  });

  test("should resolve topic name", () => {
    expect(kit.getTopicName(new TestMessageKit())).toMatchSnapshot();
  });

  test("should resolve OnConsume hooks", () => {
    const entity = kit.create();
    expect(kit.onConsume(entity)).toBeUndefined();
    expect(entity).toMatchSnapshot();
  });

  test("should resolve OnCreate hooks", () => {
    const entity = kit.create();
    expect(kit.onCreate(entity)).toBeUndefined();
    expect(entity).toMatchSnapshot();
  });

  test("should resolve OnPublish hooks", () => {
    const entity = kit.create();
    expect(kit.onPublish(entity)).toBeUndefined();
    expect(entity).toMatchSnapshot();
  });

  test("should resolve OnValidate hooks", () => {
    const entity = kit.create();
    expect(kit.onValidate(entity)).toBeUndefined();
    expect(entity).toMatchSnapshot();
  });
});
