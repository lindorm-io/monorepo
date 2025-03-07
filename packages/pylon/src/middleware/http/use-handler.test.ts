import { createMockLogger } from "@lindorm/logger";
import {
  getBody as _getBody,
  getFile as _getFile,
  getStatus as _getStatus,
} from "../../utils/private";
import { useHandler } from "./use-handler";

jest.mock("../../utils/private");

const getBody = _getBody as jest.Mock;
const getFile = _getFile as jest.Mock;
const getStatus = _getStatus as jest.Mock;

describe("useHandler", () => {
  let ctx: any;
  let handler: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      redirect: jest.fn(),
      set: jest.fn(),
    };

    handler = jest.fn();

    getBody.mockReturnValue("body");
    getFile.mockResolvedValue({
      maxAge: 123,
      immutable: true,
      filename: "file/filename",
      contentLength: 123,
      lastModified: new Date(),
      mimeType: "file/mimeType",
      stream: "file-stream",
    });
    getStatus.mockReturnValue(999);
  });

  test("should resolve", async () => {
    await expect(useHandler(handler)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(handler).toHaveBeenCalled();
    expect(ctx.body).toEqual("body");
    expect(ctx.status).toEqual(999);
  });

  test("should resolve with webhook", async () => {
    handler.mockReturnValue({ webhook: { event: "event", data: "data" } });

    await expect(useHandler(handler)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.webhook).toEqual({ event: "event", data: "data" });
  });

  test("should resolve with redirect", async () => {
    handler.mockReturnValue({ redirect: "redirect" });

    await expect(useHandler(handler)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.redirect).toHaveBeenCalledWith("redirect");
  });

  test("should resolve with file", async () => {
    handler.mockReturnValue({ file: "file" });

    await expect(useHandler(handler)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("cache-control", "max-age=123,immutable");
    expect(ctx.set).toHaveBeenCalledWith(
      "content-disposition",
      "attachment; filename=file/filename",
    );
    expect(ctx.set).toHaveBeenCalledWith("content-length", "123");
    expect(ctx.set).toHaveBeenCalledWith("content-type", "application/octet-stream");
    expect(ctx.set).toHaveBeenCalledWith("last-modified", expect.any(String));

    expect(ctx.type).toEqual("file/mimeType");
    expect(ctx.body).toEqual("file-stream");
  });

  test("should resolve with stream", async () => {
    handler.mockReturnValue({
      stream: {
        maxAge: 123,
        immutable: true,
        filename: "stream/filename",
        contentLength: 123,
        lastModified: new Date(),
        mimeType: "stream/mimeType",
        stream: "stream/stream",
      },
    });

    await expect(useHandler(handler)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("cache-control", "max-age=123,immutable");
    expect(ctx.set).toHaveBeenCalledWith(
      "content-disposition",
      "attachment; filename=stream/filename",
    );
    expect(ctx.set).toHaveBeenCalledWith("content-length", "123");
    expect(ctx.set).toHaveBeenCalledWith("content-type", "application/octet-stream");
    expect(ctx.set).toHaveBeenCalledWith("last-modified", expect.any(String));

    expect(ctx.type).toEqual("stream/mimeType");
    expect(ctx.body).toEqual("stream/stream");
  });

  test("should reject with redirect and file", async () => {
    handler.mockReturnValue({ redirect: "redirect", file: "file" });

    await expect(useHandler(handler)(ctx, jest.fn())).rejects.toThrow();
  });
});
