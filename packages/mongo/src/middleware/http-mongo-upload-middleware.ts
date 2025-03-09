import { camelCase } from "@lindorm/case";
import { ServerError } from "@lindorm/errors";
import { Constructor, Dict } from "@lindorm/types";
import { parseStringRecord } from "@lindorm/utils";
import busboy from "busboy";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { IMongoFile, IMongoSource } from "../interfaces";
import { FileUpload, MongoPylonHttpContext, MongoPylonHttpMiddleware } from "../types";

const getMetadata = <C extends MongoPylonHttpContext>(ctx: C): Dict => {
  const headers = Object.entries(ctx.request.headers)
    .map(([key, value]) => [key.toLowerCase(), value] as [string, string])
    .filter(([key]) => key.startsWith("x-file-meta-"));

  const result: Dict = {};

  for (const [key, value] of headers) {
    result[camelCase(key.replace(/^x-file-meta-/, ""))] = value;
  }

  return parseStringRecord(result);
};

export const createHttpMongoUploadMiddleware = <
  C extends MongoPylonHttpContext = MongoPylonHttpContext,
>(
  File: Constructor<IMongoFile>,
  source?: IMongoSource,
): MongoPylonHttpMiddleware<C> => {
  return async function httpMongoUploadMiddleware(ctx, next): Promise<void> {
    try {
      const bucket = source
        ? source.bucket(File, { logger: ctx.logger })
        : ctx.sources.mongo.bucket(File);

      const metadata = getMetadata(ctx);
      const promises: Array<Promise<IMongoFile>> = [];

      if (ctx.request.files) {
        for (const fileArray of Object.values(ctx.request.files ?? {})) {
          if (!fileArray) continue;

          for (const file of fileArray) {
            metadata.hash = file.hash;
            metadata.hashAlgorithm = file.hashAlgorithm;
            metadata.size = file.size;
            metadata.strategy = "formidable";

            promises.push(
              bucket.upload(createReadStream(file.filepath), {
                mimeType: file.mimetype ?? null,
                originalName: file.originalFilename ?? null,
                ...metadata,
              } satisfies FileUpload<IMongoFile>),
            );
          }
        }
      } else {
        const bb = busboy({ headers: ctx.req.headers });

        bb.on("file", (name: string, file: Readable, info: Dict): void => {
          ctx.logger.silly("Uploading file", { name, info });

          metadata.encoding = info.encoding;
          metadata.strategy = "busboy";

          promises.push(
            bucket.upload(file, {
              mimeType: info.mimeType ?? info.mimetype ?? null,
              originalName: name ?? info.filename ?? null,
              ...metadata,
            } satisfies FileUpload<IMongoFile>),
          );
        });

        ctx.req.pipe(bb);

        await new Promise<void>((resolve, reject) => {
          bb.on("close", resolve);
          bb.on("error", reject);
        });

        ctx.logger.silly("Uploading files", { promises: promises.length });
      }

      ctx.files = await Promise.all(promises);

      await next();
    } catch (error: any) {
      throw new ServerError("Failed to upload file(s)", { error });
    }
  };
};
