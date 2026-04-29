import MockDate from "mockdate";
import { LindormError } from "@lindorm/errors";
import { ProteusError } from "../../../../errors/ProteusError.js";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError.js";
import { RedisDuplicateKeyError } from "./RedisDuplicateKeyError.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const FIXED_DATE = new Date("2024-01-01T00:00:00.000Z");
const FIXED_ID = "00000000-0000-0000-0000-000000000002";

beforeAll(() => {
  MockDate.set(FIXED_DATE);
});

afterAll(() => {
  MockDate.reset();
});

// ─── instanceof ───────────────────────────────────────────────────────────────

describe("RedisDuplicateKeyError instanceof", () => {
  test("is an instance of Error", () => {
    expect(new RedisDuplicateKeyError("msg")).toBeInstanceOf(Error);
  });

  test("is an instance of LindormError", () => {
    expect(new RedisDuplicateKeyError("msg")).toBeInstanceOf(LindormError);
  });

  test("is an instance of ProteusError", () => {
    expect(new RedisDuplicateKeyError("msg")).toBeInstanceOf(ProteusError);
  });

  test("is an instance of ProteusRepositoryError", () => {
    expect(new RedisDuplicateKeyError("msg")).toBeInstanceOf(ProteusRepositoryError);
  });

  test("is an instance of RedisDuplicateKeyError", () => {
    expect(new RedisDuplicateKeyError("msg")).toBeInstanceOf(RedisDuplicateKeyError);
  });
});

// ─── name property ────────────────────────────────────────────────────────────

describe("RedisDuplicateKeyError name", () => {
  test("has the correct name property", () => {
    expect(new RedisDuplicateKeyError("msg").name).toBe("DuplicateKeyError");
  });
});

// ─── message ──────────────────────────────────────────────────────────────────

describe("RedisDuplicateKeyError message", () => {
  test("stores the provided message", () => {
    expect(new RedisDuplicateKeyError("Duplicate key for entity User").message).toBe(
      "Duplicate key for entity User",
    );
  });
});

// ─── snapshot ─────────────────────────────────────────────────────────────────

describe("RedisDuplicateKeyError snapshot", () => {
  test("serialises to JSON with expected shape", () => {
    const error = new RedisDuplicateKeyError("Duplicate key for entity User", {
      id: FIXED_ID,
      debug: { entityName: "User", key: "id:abc-123" },
    });

    const { stack, ...json } = error.toJSON();
    expect(json).toMatchSnapshot();
    expect(stack).toEqual(expect.stringContaining("DuplicateKeyError"));
  });
});
