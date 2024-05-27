import { join } from "path";
import { Readable } from "stream";
import { getReadableContent } from "../../__fixtures__/utils";
import { getFile } from "./get-file";

describe("getFile", () => {
  const file = { path: join(__dirname, "..", "..", "__fixtures__", "download.txt") };

  let ctx: any;

  beforeEach(() => {
    ctx = {
      acceptsEncodings: jest.fn(),
      config: {
        fileDownload: {
          brotli: true,
          gzip: true,
        },
      },
    };
  });

  test("should return file", async () => {
    await expect(getFile(ctx, file)).resolves.toEqual({
      contentLength: 9,
      filename: "download.txt",
      immutable: false,
      lastModified: expect.any(Date),
      maxAge: 0,
      mimeType: ".txt",
      stream: expect.any(Readable),
    });
  });

  test("should return a readable stream", async () => {
    const { stream } = await getFile(ctx, file);

    await expect(getReadableContent(stream)).resolves.toEqual("testfile\n");
  });

  describe("brotli", () => {
    test("should return file encoded with brotli", async () => {
      ctx.acceptsEncodings.mockReturnValueOnce(true);

      await expect(getFile(ctx, file)).resolves.toEqual({
        contentLength: 9,
        filename: "download.txt.br",
        immutable: false,
        lastModified: expect.any(Date),
        maxAge: 0,
        mimeType: ".txt",
        stream: expect.any(Readable),
      });
    });

    test("should not return file encoded with brotli if not accepted", async () => {
      ctx.acceptsEncodings.mockReturnValue(false);

      await expect(getFile(ctx, file)).resolves.toEqual({
        contentLength: 9,
        filename: "download.txt",
        immutable: false,
        lastModified: expect.any(Date),
        maxAge: 0,
        mimeType: ".txt",
        stream: expect.any(Readable),
      });
    });

    test("should not return file encoded with brotli if not found", async () => {
      ctx.acceptsEncodings.mockReturnValueOnce(true);

      await expect(
        getFile(ctx, { path: join(__dirname, "..", "..", "__fixtures__", "upload.txt") }),
      ).resolves.toEqual({
        contentLength: 9,
        filename: "upload.txt",
        immutable: false,
        lastModified: expect.any(Date),
        maxAge: 0,
        mimeType: ".txt",
        stream: expect.any(Readable),
      });
    });
  });

  describe("gzip", () => {
    test("should return file encoded with gzip", async () => {
      ctx.acceptsEncodings.mockReturnValueOnce(false).mockReturnValueOnce(true);

      await expect(getFile(ctx, file)).resolves.toEqual({
        contentLength: 9,
        filename: "download.txt.gz",
        immutable: false,
        lastModified: expect.any(Date),
        maxAge: 0,
        mimeType: ".txt",
        stream: expect.any(Readable),
      });
    });

    test("should not return file encoded with gzip if not accepted", async () => {
      ctx.acceptsEncodings.mockReturnValue(false);

      await expect(getFile(ctx, file)).resolves.toEqual({
        contentLength: 9,
        filename: "download.txt",
        immutable: false,
        lastModified: expect.any(Date),
        maxAge: 0,
        mimeType: ".txt",
        stream: expect.any(Readable),
      });
    });

    test("should not return file encoded with brotli if not found", async () => {
      ctx.acceptsEncodings.mockReturnValueOnce(false).mockReturnValueOnce(true);

      await expect(
        getFile(ctx, { path: join(__dirname, "..", "..", "__fixtures__", "upload.txt") }),
      ).resolves.toEqual({
        contentLength: 9,
        filename: "upload.txt",
        immutable: false,
        lastModified: expect.any(Date),
        maxAge: 0,
        mimeType: ".txt",
        stream: expect.any(Readable),
      });
    });
  });
});
