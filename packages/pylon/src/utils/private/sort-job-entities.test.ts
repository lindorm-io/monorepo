import { IQueueableEntity } from "../../interfaces";
import { sortJobEntities } from "./sort-job-entities";

describe("sortJobEntities", () => {
  const baseTime = new Date("2024-01-01T00:00:00Z");

  const create = (
    priority: number | undefined,
    createdAtOffsetMs: number,
  ): IQueueableEntity =>
    ({
      priority,
      createdAt: new Date(baseTime.getTime() + createdAtOffsetMs),
    }) as IQueueableEntity;

  test("should sort by priority descending", () => {
    const a = create(5, 0);
    const b = create(10, 0);

    const result = [a, b].sort(sortJobEntities);

    expect(result).toEqual([b, a]);
  });

  test("should sort by createdAt ascending when priority is equal", () => {
    const a = create(3, 1000);
    const b = create(3, 0);

    const result = [a, b].sort(sortJobEntities);

    expect(result).toEqual([b, a]);
  });

  test("should fallback to priority 1 when undefined (a undefined)", () => {
    const a = create(undefined, 0);
    const b = create(5, 0);

    const result = [a, b].sort(sortJobEntities);

    expect(result).toEqual([b, a]);
  });

  test("should fallback to priority 1 when undefined (b undefined)", () => {
    const a = create(5, 0);
    const b = create(undefined, 0);

    const result = [a, b].sort(sortJobEntities);

    expect(result).toEqual([a, b]);
  });

  test("should fallback to createdAt when both priority are undefined", () => {
    const a = create(undefined, 2000);
    const b = create(undefined, 1000);

    const result = [a, b].sort(sortJobEntities);

    expect(result).toEqual([b, a]);
  });

  test("should handle exact same timestamps and priorities", () => {
    const a = create(2, 0);
    const b = create(2, 0);

    const result = [a, b].sort(sortJobEntities);

    expect(result).toEqual([a, b]);
  });
});
