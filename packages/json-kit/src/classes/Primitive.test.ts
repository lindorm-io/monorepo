import MockDate from "mockdate";
import {
  TEST_ARRAY,
  TEST_ARRAY_STRING,
  TEST_DICT,
  TEST_DICT_STRING,
} from "../__fixtures__/test-data";
import { Primitive } from "./Primitive";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("Primitive", () => {
  describe("array", () => {
    let struct: Primitive;

    beforeAll(() => {
      struct = new Primitive(TEST_ARRAY);
    });

    test("should resolve expected data", () => {
      expect(struct.data).toMatchSnapshot();
    });

    test("should resolve expected meta", () => {
      expect(struct.meta).toMatchSnapshot();
    });

    test("should resolve expected json", () => {
      expect(struct.toJSON()).toMatchSnapshot();
    });

    test("should resolve expected string", () => {
      expect(struct.toString()).toMatchSnapshot();
    });
  });

  describe("dict", () => {
    let struct: Primitive;

    beforeAll(() => {
      struct = new Primitive(TEST_DICT);
    });

    test("should resolve expected data", () => {
      expect(struct.data).toMatchSnapshot();
    });

    test("should resolve expected meta", () => {
      expect(struct.meta).toMatchSnapshot();
    });

    test("should resolve expected json", () => {
      expect(struct.toJSON()).toMatchSnapshot();
    });

    test("should resolve expected string", () => {
      expect(struct.toString()).toMatchSnapshot();
    });
  });

  describe("string (array)", () => {
    let struct: Primitive;

    beforeAll(() => {
      struct = new Primitive(TEST_ARRAY_STRING);
    });

    test("should resolve expected data", () => {
      expect(struct.data).toMatchSnapshot();
    });

    test("should resolve expected meta", () => {
      expect(struct.meta).toMatchSnapshot();
    });

    test("should resolve expected json", () => {
      expect(struct.toJSON()).toMatchSnapshot();
    });

    test("should resolve expected string", () => {
      expect(struct.toString()).toMatchSnapshot();
    });
  });

  describe("string (json)", () => {
    let struct: Primitive;

    beforeAll(() => {
      struct = new Primitive(TEST_DICT_STRING);
    });

    test("should resolve expected data", () => {
      expect(struct.data).toMatchSnapshot();
    });

    test("should resolve expected meta", () => {
      expect(struct.meta).toMatchSnapshot();
    });

    test("should resolve expected json", () => {
      expect(struct.toJSON()).toMatchSnapshot();
    });

    test("should resolve expected string", () => {
      expect(struct.toString()).toMatchSnapshot();
    });
  });
});
