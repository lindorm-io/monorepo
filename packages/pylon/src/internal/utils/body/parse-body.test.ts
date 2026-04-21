import { ClientError } from "@lindorm/errors";
import _CoBody from "co-body";
import type { BodyType } from "../../../types/index.js";
import { composeParseBodyConfig } from "../compose-parse-body-config.js";
import { parseBody } from "./parse-body.js";
import { parseWithFormidable as _parseWithFormidable } from "./parse-with-formidable.js";
import { beforeEach, describe, expect, test, vi, type Mock, type Mocked } from "vitest";

vi.mock("co-body");
vi.mock("./parse-with-formidable.js");

const parseWithFormidable = _parseWithFormidable as Mock;
const CoBody = _CoBody as Mocked<typeof _CoBody>;

describe("parseBody", async () => {
  let ctx: any;
  let config: any;
  let bodyType: BodyType;

  beforeEach(() => {
    ctx = {
      request: {
        body: "multipart",
      },
      get: vi.fn(),
    };

    config = composeParseBodyConfig();

    bodyType = "json";

    parseWithFormidable.mockResolvedValue("FormidableResult");

    CoBody.json.mockResolvedValue("CoBodyJson");
    CoBody.form.mockResolvedValue("CoBodyForm");
    CoBody.text.mockResolvedValue("CoBodyText");
  });

  test("should parse json body", async () => {
    expect(await parseBody(ctx, config, bodyType)).toEqual("CoBodyJson");
  });

  test("should parse url encoded body", async () => {
    bodyType = "urlencoded";

    expect(await parseBody(ctx, config, bodyType)).toEqual("CoBodyForm");
  });

  test("should parse text body", async () => {
    bodyType = "text";

    expect(await parseBody(ctx, config, bodyType)).toEqual("CoBodyText");
  });

  test("should parse multipart body", async () => {
    bodyType = "multipart";

    config.multipart = true;

    expect(await parseBody(ctx, config, bodyType)).toEqual({});
  });

  test("should parse multipart body with formidable", async () => {
    bodyType = "multipart";

    config.multipart = true;
    config.formidable = true;

    expect(await parseBody(ctx, config, bodyType)).toEqual("FormidableResult");
  });

  test("should throw error if multipart body is not supported", async () => {
    bodyType = "multipart";

    await expect(parseBody(ctx, config, bodyType)).rejects.toThrow(ClientError);
  });
});
