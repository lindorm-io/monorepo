import { LindormError } from "@lindorm/errors";
import { composeObjectMetadata } from "./compose-metadata";

class TestEntity {
  state: any;
  meta: any;

  constructor() {
    this.state = {};
    this.meta = {};
  }

  change(input: any, timestamp: Date) {
    const { state, meta } = composeObjectMetadata(
      this.state,
      input,
      this.meta,
      timestamp,
    );

    this.state = state;
    this.meta = meta;
  }
}

describe("composeObjectMetadata", () => {
  const ts1 = new Date("2022-01-01T08:00:00.000Z");
  const ts2 = new Date("2022-01-02T08:00:00.000Z");
  const ts3 = new Date("2022-01-03T08:00:00.000Z");
  const ts4 = new Date("2022-01-04T08:00:00.000Z");

  test("should resolve changes to key values", () => {
    const test = new TestEntity();

    test.change({ ...test.state, one: 1 }, ts1);
    expect(test.state).toEqual({ one: 1 });
    expect(test.meta).toEqual({
      one: { destroyed: false, value: 1, timestamp: ts1 },
    });

    test.change({ ...test.state, one: "one" }, ts2);
    expect(test.state).toEqual({ one: "one" });
    expect(test.meta).toEqual({
      one: { destroyed: false, value: "one", timestamp: ts2 },
    });

    test.change({ ...test.state, one: 0 }, ts3);
    expect(test.state).toEqual({ one: 0 });
    expect(test.meta).toEqual({
      one: { destroyed: false, value: 0, timestamp: ts3 },
    });

    test.change({}, ts4);
    expect(test.state).toEqual({});
    expect(test.meta).toEqual({
      one: { destroyed: true, value: 0, timestamp: ts4 },
    });
  });

  test("should skip outdated input for key values", () => {
    const test = new TestEntity();

    test.change({ ...test.state, one: 1 }, ts2);
    expect(test.state).toEqual({ one: 1 });
    expect(test.meta).toEqual({
      one: { destroyed: false, value: 1, timestamp: ts2 },
    });

    test.change({ ...test.state, one: "one" }, ts1);
    expect(test.state).toEqual({ one: 1 });
    expect(test.meta).toEqual({
      one: { destroyed: false, value: 1, timestamp: ts2 },
    });
  });

  test("should resolve changes to objects", () => {
    const test = new TestEntity();

    test.change({ one: { tree: "hill" } }, ts1);
    expect(test.state).toEqual({
      one: { tree: "hill" },
    });
    expect(test.meta).toEqual({
      one: {
        tree: {
          destroyed: false,
          timestamp: ts1,
          value: "hill",
        },
      },
    });

    test.change({ one: { tree: "hill", sun: 1 } }, ts2);
    expect(test.state).toEqual({
      one: { tree: "hill", sun: 1 },
    });
    expect(test.meta).toEqual({
      one: {
        sun: {
          destroyed: false,
          timestamp: ts2,
          value: 1,
        },
        tree: {
          destroyed: false,
          timestamp: ts1,
          value: "hill",
        },
      },
    });

    test.change({}, ts3);
    expect(test.state).toEqual({});
    expect(test.meta).toEqual({
      one: {
        sun: {
          destroyed: true,
          timestamp: ts3,
          value: 1,
        },
        tree: {
          destroyed: true,
          timestamp: ts3,
          value: "hill",
        },
      },
    });

    test.change({ one: { moon: 1 } }, ts4);
    expect(test.state).toEqual({ one: { moon: 1 } });
    expect(test.meta).toEqual({
      one: {
        moon: {
          destroyed: false,
          timestamp: ts4,
          value: 1,
        },
        sun: {
          destroyed: true,
          timestamp: ts3,
          value: 1,
        },
        tree: {
          destroyed: true,
          timestamp: ts3,
          value: "hill",
        },
      },
    });
  });

  test("should skip outdated input for objects", () => {
    const test = new TestEntity();

    test.change({ one: { tree: "hill" } }, ts2);
    expect(test.state).toEqual({
      one: { tree: "hill" },
    });
    expect(test.meta).toEqual({
      one: { tree: { destroyed: false, value: "hill", timestamp: ts2 } },
    });

    test.change({ one: { tree: 2 } }, ts1);
    expect(test.state).toEqual({
      one: { tree: "hill" },
    });
    expect(test.meta).toEqual({
      one: { tree: { destroyed: false, value: "hill", timestamp: ts2 } },
    });
  });

  test("should resolve changes to array with primitives", () => {
    const test = new TestEntity();

    test.change({ one: [1, 2, 3] }, ts1);
    expect(test.state).toEqual({ one: [1, 2, 3] });
    expect(test.meta).toEqual({
      one: [
        { destroyed: false, value: 1, timestamp: ts1 },
        { destroyed: false, value: 2, timestamp: ts1 },
        { destroyed: false, value: 3, timestamp: ts1 },
      ],
    });

    test.change({ one: [1, 2, 3, 4] }, ts2);
    expect(test.state).toEqual({ one: [1, 2, 3, 4] });
    expect(test.meta).toEqual({
      one: [
        { destroyed: false, value: 1, timestamp: ts1 },
        { destroyed: false, value: 2, timestamp: ts1 },
        { destroyed: false, value: 3, timestamp: ts1 },
        { destroyed: false, value: 4, timestamp: ts2 },
      ],
    });

    test.change({ one: [3, 4] }, ts3);
    expect(test.state).toEqual({ one: [3, 4] });
    expect(test.meta).toEqual({
      one: [
        {
          destroyed: true,
          timestamp: ts3,
          value: 1,
        },
        {
          destroyed: true,
          timestamp: ts3,
          value: 2,
        },
        {
          destroyed: false,
          timestamp: ts1,
          value: 3,
        },
        {
          destroyed: false,
          timestamp: ts2,
          value: 4,
        },
      ],
    });
  });

  test("should resolve changes to array with objects", () => {
    const test = new TestEntity();

    test.change({ one: [{ key: 1, number: 1 }] }, ts1);
    expect(test.state).toEqual({ one: [{ key: 1, number: 1 }] });
    expect(test.meta).toEqual({
      one: [
        {
          destroyed: false,
          timestamp: ts1,
          value: {
            key: 1,
            number: 1,
          },
        },
      ],
    });

    test.change(
      {
        one: [
          { key: 1, number: 1 },
          { key: 2, word: "two" },
          { key: 3, word: "three" },
        ],
      },
      ts2,
    );
    expect(test.state).toEqual({
      one: [
        { key: 1, number: 1 },
        { key: 2, word: "two" },
        { key: 3, word: "three" },
      ],
    });
    expect(test.meta).toEqual({
      one: [
        {
          destroyed: false,
          timestamp: ts1,
          value: {
            key: 1,
            number: 1,
          },
        },
        {
          destroyed: false,
          timestamp: ts2,
          value: {
            key: 2,
            word: "two",
          },
        },
        {
          destroyed: false,
          timestamp: ts2,
          value: {
            key: 3,
            word: "three",
          },
        },
      ],
    });

    test.change(
      {
        one: [{ key: 3, word: "three" }],
      },
      ts3,
    );
    expect(test.state).toEqual({
      one: [{ key: 3, word: "three" }],
    });
    expect(test.meta).toEqual({
      one: [
        {
          destroyed: true,
          timestamp: ts3,
          value: {
            key: 1,
            number: 1,
          },
        },
        {
          destroyed: true,
          timestamp: ts3,
          value: {
            key: 2,
            word: "two",
          },
        },
        {
          destroyed: false,
          timestamp: ts2,
          value: {
            key: 3,
            word: "three",
          },
        },
      ],
    });
  });

  test("should skip outdated input for array with objects", () => {
    const test = new TestEntity();

    test.change({ one: [{ key: 1, number: 1 }] }, ts4);
    expect(test.state).toEqual({ one: [{ key: 1, number: 1 }] });
    expect(test.meta).toEqual({
      one: [
        {
          destroyed: false,
          timestamp: ts4,
          value: {
            key: 1,
            number: 1,
          },
        },
      ],
    });

    test.change({ one: [{ key: 1, number: "one" }] }, ts1);
    expect(test.state).toEqual({ one: [{ key: 1, number: 1 }] });
    expect(test.meta).toEqual({
      one: [
        {
          destroyed: false,
          timestamp: ts4,
          value: {
            key: 1,
            number: 1,
          },
        },
      ],
    });
  });

  test("should throw on invalid state change", () => {
    const test = new TestEntity();

    expect(() => test.change({ one: [{ number: 1 }] }, ts1)).toThrow(LindormError);
  });
});
