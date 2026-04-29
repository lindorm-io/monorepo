import MockDate from "mockdate";
import { LindormError } from "@lindorm/errors";
import { ProteusError } from "../../../../errors/ProteusError.js";
import { RedisDriverError } from "./RedisDriverError.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const FIXED_DATE = new Date("2024-01-01T00:00:00.000Z");
const FIXED_ID = "00000000-0000-0000-0000-000000000001";

beforeAll(() => {
  MockDate.set(FIXED_DATE);
});

afterAll(() => {
  MockDate.reset();
});

// ─── instanceof ───────────────────────────────────────────────────────────────

describe("RedisDriverError instanceof", () => {
  test("is an instance of Error", () => {
    expect(new RedisDriverError("msg")).toBeInstanceOf(Error);
  });

  test("is an instance of LindormError", () => {
    expect(new RedisDriverError("msg")).toBeInstanceOf(LindormError);
  });

  test("is an instance of ProteusError", () => {
    expect(new RedisDriverError("msg")).toBeInstanceOf(ProteusError);
  });

  test("is an instance of RedisDriverError", () => {
    expect(new RedisDriverError("msg")).toBeInstanceOf(RedisDriverError);
  });
});

// ─── name property ────────────────────────────────────────────────────────────

describe("RedisDriverError name", () => {
  test("has the correct name property", () => {
    expect(new RedisDriverError("msg").name).toBe("RedisDriverError");
  });
});

// ─── message ──────────────────────────────────────────────────────────────────

describe("RedisDriverError message", () => {
  test("stores the provided message", () => {
    expect(new RedisDriverError("Redis client is not connected").message).toBe(
      "Redis client is not connected",
    );
  });
});

// ─── snapshot ─────────────────────────────────────────────────────────────────

describe("RedisDriverError snapshot", () => {
  test("serialises to JSON with expected shape", () => {
    const error = new RedisDriverError(
      "Redis client is not connected. Call connect() first.",
      {
        id: FIXED_ID,
      },
    );

    const { stack, ...json } = error.toJSON();
    expect(json).toMatchSnapshot();
    expect(stack).toEqual(expect.stringContaining("RedisDriverError"));
  });

  test("accepts debug metadata", () => {
    const error = new RedisDriverError("Cannot commit: transaction is committed", {
      id: FIXED_ID,
      debug: { state: "committed" },
    });

    const { stack, ...json } = error.toJSON();
    expect(json).toMatchSnapshot();
    expect(stack).toEqual(expect.stringContaining("RedisDriverError"));
  });
});
