import { HttpMethod } from "@lindorm/enums";
import { BodyType } from "../../enums";
import { PylonError } from "../../errors";
import {
  composeParseBodyConfig as _composeParseBodyConfig,
  getBodyType as _getBodyType,
  parseBody as _parseBody,
} from "../../utils/private";
import { httpBodyParserMiddleware } from "./http-body-parser-middleware";

jest.mock("../../utils/private");

const composeParseBodyConfig = _composeParseBodyConfig as jest.Mock;
const getBodyType = _getBodyType as jest.Mock;
const parseBody = _parseBody as jest.Mock;

describe("createHttpBodyParserMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      query: {
        snake_case_query: "query",
      },
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
      methods: [HttpMethod.Post, HttpMethod.Put, HttpMethod.Patch],
      multipart: true,
    });
    getBodyType.mockReturnValue(BodyType.Json);
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
    await expect(httpBodyParserMiddleware()(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.request.body).toEqual({ value: "parsed", snake_case_key: "body" });
    expect(ctx.request.files).toEqual([]);
    expect(ctx.request.raw).toEqual('{"value":"parsed"}');
  });

  test("should change case and set on data when body type is json", async () => {
    await expect(httpBodyParserMiddleware()(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({
      snakeCaseKey: "body",
      snakeCaseQuery: "query",
      value: "parsed",
    });
  });

  test("should change case and set on data when body type is urlencoded", async () => {
    getBodyType.mockReturnValue(BodyType.UrlEncoded);

    await expect(httpBodyParserMiddleware()(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({
      snakeCaseKey: "body",
      snakeCaseQuery: "query",
      value: "parsed",
    });
  });

  test("should not change case of body when multipart", async () => {
    getBodyType.mockReturnValue(BodyType.Multipart);

    await expect(httpBodyParserMiddleware()(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({ snakeCaseQuery: "query" });
  });

  test("should not change case of body when text", async () => {
    getBodyType.mockReturnValue(BodyType.Text);

    await expect(httpBodyParserMiddleware()(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.data).toEqual({ snakeCaseQuery: "query" });
  });

  test("should not parse body if method is not POST, PUT or PATCH", async () => {
    ctx.method = "GET";

    await expect(httpBodyParserMiddleware()(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.request.body).toBeUndefined();
    expect(ctx.request.files).toBeUndefined();
    expect(ctx.request.raw).toBeUndefined();
  });

  test("should throw client error if body parsing fails", async () => {
    const error = new PylonError("Failed to parse body");

    parseBody.mockRejectedValue(error);

    await expect(httpBodyParserMiddleware()(ctx, jest.fn())).rejects.toThrow(error);
  });
});
