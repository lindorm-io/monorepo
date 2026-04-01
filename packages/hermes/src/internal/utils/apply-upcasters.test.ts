import { UpcasterChainError } from "../../errors";
import type { RegisteredAggregate, RegisteredUpcaster } from "#internal/registry";
import { applyUpcasters } from "./apply-upcasters";

describe("applyUpcasters", () => {
  test("should apply single upcaster step", () => {
    const mockAggregate = {
      target: class {
        upcastV1toV2(data: Record<string, unknown>) {
          return { ...data, addedField: 42 };
        }
      },
    } as unknown as RegisteredAggregate;

    const chain: Array<RegisteredUpcaster> = [
      {
        fromName: "test",
        fromVersion: 1,
        toVersion: 2,
        method: "upcastV1toV2",
        from: class {} as any,
        to: class {} as any,
      },
    ];

    const result = applyUpcasters(mockAggregate, chain, { value: "hello" });

    expect(result).toMatchSnapshot();
  });

  test("should apply chained upcasters in sequence", () => {
    const mockAggregate = {
      target: class {
        upcastV1toV2(data: Record<string, unknown>) {
          return { ...data, addedField: 0 };
        }
        upcastV2toV3(data: Record<string, unknown>) {
          return { ...data, extraField: false };
        }
      },
    } as unknown as RegisteredAggregate;

    const chain: Array<RegisteredUpcaster> = [
      {
        fromName: "test",
        fromVersion: 1,
        toVersion: 2,
        method: "upcastV1toV2",
        from: class {} as any,
        to: class {} as any,
      },
      {
        fromName: "test",
        fromVersion: 2,
        toVersion: 3,
        method: "upcastV2toV3",
        from: class {} as any,
        to: class {} as any,
      },
    ];

    const result = applyUpcasters(mockAggregate, chain, { value: "hello" });

    expect(result).toMatchSnapshot();
  });

  test("should throw UpcasterChainError when method is missing on aggregate", () => {
    const mockAggregate = {
      name: "test_aggregate",
      target: class {},
    } as unknown as RegisteredAggregate;

    const chain: Array<RegisteredUpcaster> = [
      {
        fromName: "test",
        fromVersion: 1,
        toVersion: 2,
        method: "nonExistentMethod",
        from: class {} as any,
        to: class {} as any,
      },
    ];

    expect(() => applyUpcasters(mockAggregate, chain, { value: "hello" })).toThrow(
      UpcasterChainError,
    );
  });

  test("should pass output of previous step as input to next step", () => {
    const calls: Array<Record<string, unknown>> = [];

    const mockAggregate = {
      target: class {
        step1(data: Record<string, unknown>) {
          calls.push({ ...data });
          return { ...data, step1: true };
        }
        step2(data: Record<string, unknown>) {
          calls.push({ ...data });
          return { ...data, step2: true };
        }
      },
    } as unknown as RegisteredAggregate;

    const chain: Array<RegisteredUpcaster> = [
      {
        fromName: "test",
        fromVersion: 1,
        toVersion: 2,
        method: "step1",
        from: class {} as any,
        to: class {} as any,
      },
      {
        fromName: "test",
        fromVersion: 2,
        toVersion: 3,
        method: "step2",
        from: class {} as any,
        to: class {} as any,
      },
    ];

    applyUpcasters(mockAggregate, chain, { original: true });

    // step1 receives the original data
    expect(calls[0]).toEqual({ original: true });
    // step2 receives the output of step1
    expect(calls[1]).toEqual({ original: true, step1: true });
  });
});
