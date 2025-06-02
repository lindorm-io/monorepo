import { ClientError } from "@lindorm/errors";
import _CoBody from "co-body";
import { BodyType } from "../../../enums";
import { composeParseBodyConfig } from "../compose-parse-body-config";
import { parseBody } from "./parse-body";
import { parseWithFormidable as _parseWithFormidable } from "./parse-with-formidable";

jest.mock("co-body");
jest.mock("./parse-with-formidable");

const parseWithFormidable = _parseWithFormidable as jest.Mock;
const CoBody = _CoBody as jest.Mocked<typeof _CoBody>;

describe("parseBody", () => {
  let ctx: any;
  let config: any;
  let bodyType: BodyType;

  beforeEach(() => {
    ctx = {
      request: {
        body: "multipart",
      },
      get: jest.fn(),
    };

    config = composeParseBodyConfig();

    bodyType = BodyType.Json;

    parseWithFormidable.mockResolvedValue("FormidableResult");

    CoBody.json.mockResolvedValue("CoBodyJson");
    CoBody.form.mockResolvedValue("CoBodyForm");
    CoBody.text.mockResolvedValue("CoBodyText");
  });

  test("should parse json body", async () => {
    expect(await parseBody(ctx, config, bodyType)).toEqual("CoBodyJson");
  });

  test("should parse url encoded body", async () => {
    bodyType = BodyType.UrlEncoded;

    expect(await parseBody(ctx, config, bodyType)).toEqual("CoBodyForm");
  });

  test("should parse text body", async () => {
    bodyType = BodyType.Text;

    expect(await parseBody(ctx, config, bodyType)).toEqual("CoBodyText");
  });

  test("should parse multipart body", async () => {
    bodyType = BodyType.Multipart;

    config.multipart = true;

    expect(await parseBody(ctx, config, bodyType)).toEqual({});
  });

  test("should parse multipart body with formidable", async () => {
    bodyType = BodyType.Multipart;

    config.multipart = true;
    config.formidable = true;

    expect(await parseBody(ctx, config, bodyType)).toEqual("FormidableResult");
  });

  test("should throw error if multipart body is not supported", async () => {
    bodyType = BodyType.Multipart;

    await expect(parseBody(ctx, config, bodyType)).rejects.toThrow(ClientError);
  });
});
