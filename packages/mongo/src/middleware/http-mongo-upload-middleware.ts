import { camelCase } from "@lindorm/case";
import { ServerError } from "@lindorm/errors";
import { Constructor, Dict } from "@lindorm/types";
import busboy from "busboy";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { IMongoFile, IMongoSource } from "../interfaces";
import { FileMetadata, MongoPylonHttpContext, MongoPylonHttpMiddleware } from "../types";

const getMetadata = <C extends MongoPylonHttpContext>(ctx: C): Dict => {
  const headers = Object.entries(ctx.request.headers)
    .map(([key, value]) => [key.toLowerCase(), value] as [string, string])
    .filter(([key]) => key.startsWith("x-file-meta-"));

  const result: Dict = {};

  for (const [key, value] of headers) {
    result[camelCase(key.replace(/^x-file-meta-/, ""))] = value;
  }

  return result;
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
            metadata.formidable = true;
            metadata.hash = file.hash;
            metadata.hashAlgorithm = file.hashAlgorithm;
            metadata.size = file.size;

            promises.push(
              bucket.upload(createReadStream(file.filepath), {
                ...metadata,
                mimeType:
                  file.mimetype ?? ctx.get("x-file-meta-mime-type") ?? "unknown/unknown",
                originalName:
                  file.originalFilename ??
                  ctx.get("x-file-meta-original-filename") ??
                  "unknown",
              } satisfies FileMetadata<IMongoFile>),
            );
          }
        }
      } else {
        const bb = busboy({ headers: ctx.req.headers });

        bb.on("file", (name: string, file: Readable, info: Dict): void => {
          ctx.logger.silly("Uploading file", { name, info });

          metadata.busboy = true;
          metadata.encoding = info.encoding;

          promises.push(
            bucket.upload(file, {
              ...metadata,
              mimeType:
                info.mimeType ??
                info.mimetype ??
                ctx.get("x-file-meta-mime-type") ??
                "unknown/unknown",
              originalName:
                name ??
                info.filename ??
                ctx.get("x-file-meta-original-filename") ??
                "unknown",
            } satisfies FileMetadata<IMongoFile>),
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
