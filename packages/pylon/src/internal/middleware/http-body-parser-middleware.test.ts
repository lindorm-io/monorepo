import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { PylonError } from "../../errors/index.js";
import { getBodyType as _getBodyType } from "../utils/body/get-body-type.js";
import { parseBody as _parseBody } from "../utils/body/parse-body.js";
import { composeParseBodyConfig as _composeParseBodyConfig } from "../utils/compose-parse-body-config.js";
import { createHttpBodyParserMiddleware } from "./http-body-parser-middleware.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

vi.mock("../utils/body/get-body-type.js");
vi.mock("../utils/body/parse-body.js");
vi.mock("../utils/compose-parse-body-config.js");

const composeParseBodyConfig = _composeParseBodyConfig as Mock;
const getBodyType = _getBodyType as Mock;
const parseBody = _parseBody as Mock;

describe("createHttpBodyParserMiddleware", async () => {
  const array = ["array"];
  const date = MockedDate;
  const error = new Error("error");
  const string = "string";

  let ctx: any;

  beforeEach(() => {
    ctx = {
      body: {
        PascalCaseTwo: "PascalCaseTwo",
        camelCaseTwo: "camelCaseTwo",
        snake_case_two: "snake_case_two",
        array,
        date,
        error,
        string,
      },
      logger: createMockLogger(),
      method: "POST",
      request: {},
    };

    composeParseBodyConfig.mockReturnValue({
      formidable: true,
      formidableOptions: {},
      limits: {
        form: "1mb",
        json: "1mb",
        text: "1mb",
      },
      methods: ["POST", "PUT", "PATCH"],
      multipart: true,
    });
    getBodyType.mockReturnValue("json");
    parseBody.mockResolvedValue({
      parsed: {
        value: "parsed",
        snake_case_key: "body",
      },
      files: [],
      raw: '{"value":"parsed"}',
    });
  });

  test("should parse body and files and set it on request context", async () => {
    await expect(createHttpBodyParserMiddleware()(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.request.body).toEqual({ value: "parsed", snake_case_key: "body" });
    expect(ctx.request.files).toEqual([]);
    expect(ctx.request.raw).toEqual('{"value":"parsed"}');
  });

  test("should change case and set on data when body type is json", async () => {
    await expect(createHttpBodyParserMiddleware()(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({
      snakeCaseKey: "body",
      value: "parsed",
    });
  });

  test("should change case and set on data when body type is urlencoded", async () => {
    getBodyType.mockReturnValue("urlencoded");

    await expect(createHttpBodyParserMiddleware()(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({
      snakeCaseKey: "body",
      value: "parsed",
    });
  });

  test("should not change case of body when multipart", async () => {
    getBodyType.mockReturnValue("multipart");

    await expect(createHttpBodyParserMiddleware()(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({});
  });

  test("should not change case of body when text", async () => {
    getBodyType.mockReturnValue("text");

    await expect(createHttpBodyParserMiddleware()(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({});
  });

  test("should not parse body if method is not POST, PUT or PATCH", async () => {
    ctx.method = "GET";

    await expect(createHttpBodyParserMiddleware()(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.request.body).toBeUndefined();
    expect(ctx.request.files).toBeUndefined();
    expect(ctx.request.raw).toBeUndefined();
  });

  test("should throw client error if body parsing fails", async () => {
    const error = new PylonError("Failed to parse body");

    parseBody.mockRejectedValue(error);

    await expect(createHttpBodyParserMiddleware()(ctx, vi.fn())).rejects.toThrow(error);
  });
});
