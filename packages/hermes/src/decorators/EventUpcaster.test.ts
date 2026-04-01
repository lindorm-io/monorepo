import type { StagedMetadata } from "#internal/metadata";
import { EventUpcaster } from "./EventUpcaster";

const createMockMethodContext = (
  metadata: DecoratorMetadataObject,
  methodName: string,
): ClassMethodDecoratorContext =>
  ({ metadata, name: methodName }) as ClassMethodDecoratorContext;

describe("EventUpcaster", () => {
  test("should stage upcaster with from, to, and method", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class FundsDeposited_V1 {
      amount!: number;
    }
    class FundsDeposited_V2 {
      amount!: number;
      currency!: string;
    }

    const fn = (_data: FundsDeposited_V1): FundsDeposited_V2 => ({}) as any;
    EventUpcaster(FundsDeposited_V1, FundsDeposited_V2)(
      fn,
      createMockMethodContext(metadata, "upcastDeposit"),
    );

    const staged = metadata as StagedMetadata;
    expect(staged.upcasters).toHaveLength(1);
    expect(staged.upcasters![0].from).toBe(FundsDeposited_V1);
    expect(staged.upcasters![0].to).toBe(FundsDeposited_V2);
    expect(staged.upcasters![0].method).toBe("upcastDeposit");
  });

  test("should append multiple upcasters to the same metadata", () => {
    const metadata: DecoratorMetadataObject = Object.create(
      null,
    ) as DecoratorMetadataObject;

    class EventA_V1 {}
    class EventA_V2 {}
    class EventB_V1 {}
    class EventB_V2 {}

    const fnA = (_data: EventA_V1): EventA_V2 => ({}) as any;
    EventUpcaster(EventA_V1, EventA_V2)(
      fnA,
      createMockMethodContext(metadata, "upcastA"),
    );

    const fnB = (_data: EventB_V1): EventB_V2 => ({}) as any;
    EventUpcaster(EventB_V1, EventB_V2)(
      fnB,
      createMockMethodContext(metadata, "upcastB"),
    );

    const staged = metadata as StagedMetadata;
    expect(staged.upcasters).toHaveLength(2);
    expect(staged.upcasters![0].from).toBe(EventA_V1);
    expect(staged.upcasters![0].to).toBe(EventA_V2);
    expect(staged.upcasters![0].method).toBe("upcastA");
    expect(staged.upcasters![1].from).toBe(EventB_V1);
    expect(staged.upcasters![1].to).toBe(EventB_V2);
    expect(staged.upcasters![1].method).toBe("upcastB");
  });
});
