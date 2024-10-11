import { snakeCase } from "@lindorm/case";
import { ILogger } from "@lindorm/logger";
import { Constructor, Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { DeleteOptions, Filter, FindOptions, GridFSBucket } from "mongodb";
import { Readable } from "stream";
import { MongoBucketError } from "../errors";
import { IMongoBucket, IMongoFile } from "../interfaces";
import { GridFSDocument } from "../interfaces/private";
import {
  FileDownload,
  FileIndex,
  FileMetadata,
  MongoBucketOptions,
  ValidateMongoFileFn,
} from "../types";
import { MongoBase } from "./MongoBase";

export class MongoBucket<F extends IMongoFile>
  extends MongoBase<FileIndex<F>>
  implements IMongoBucket<F>
{
  private readonly FileConstructor: Constructor<F>;
  private readonly bucketName: string;
  private readonly chunkSizeBytes: number | undefined;
  private readonly validate: ValidateMongoFileFn<F> | undefined;
  private _grid: GridFSBucket | undefined;

  protected readonly logger: ILogger;

  public constructor(options: MongoBucketOptions<F>) {
    super({
      client: options.client,
      collectionName: MongoBucket.createCollectionName(options),
      databaseName: options.database,
      logger: options.logger,
      indexes: [
        {
          index: { filename: 1 },
          unique: true,
        },
        {
          index: { "metadata.mimeType": 1 },
          unique: false,
        },
        {
          index: { "metadata.originalName": 1 },
          unique: false,
          nullable: ["metadata.originalName"],
        },
        ...(options.indexes
          ? options.indexes.map((item) => ({
              ...item,
              index: Object.entries(item.index).reduce(
                (acc, [key, value]) => ({
                  ...acc,
                  [`metadata.${key}`]: value,
                }),
                {},
              ),
              ...(item.nullable
                ? { nullable: item.nullable.map((key) => `metadata.${key as string}`) }
                : {}),
            }))
          : []),
      ],
    });

    this.logger = options.logger.child(["MongoMongoBucket", options.File.name]);

    this.FileConstructor = options.File;
    this.bucketName = MongoBucket.createBucketName(options);
    this.chunkSizeBytes = options.chunkSizeBytes;
    this.validate = options.validate;
  }

  // getters

  protected get grid(): GridFSBucket {
    if (!this._grid) {
      this._grid = new GridFSBucket(this.client.db(this.databaseName), {
        bucketName: this.bucketName,
        ...(this.chunkSizeBytes ? { chunkSizeBytes: this.chunkSizeBytes } : {}),
      });
    }

    return this._grid;
  }

  // public

  public async delete(criteria: Filter<F>, options?: DeleteOptions): Promise<void> {
    const start = Date.now();

    try {
      const filter = this.parseFilter(criteria);
      const result = await this.collection.find(filter).toArray();

      for (const document of result) {
        await this.grid.delete(document._id);
      }

      await this.collection.deleteMany(filter, options);

      this.logger.debug("Bucket done: delete", {
        input: {
          filter,
        },
        result: {
          ...result,
          time: Date.now() - start,
        },
      });
    } catch (error: any) {
      this.logger.error("MongoBucket error", error);
      throw new MongoBucketError("Unable to delete files", { error });
    }
  }

  public async deleteByFilename(filename: string): Promise<void> {
    const start = Date.now();

    try {
      const result = await this.collection.findOne({ filename });

      await this.collection.deleteOne({ _id: result._id });
      await this.grid.delete(result._id);

      this.logger.debug("Bucket done: deleteByFilename", {
        input: {
          filename,
        },
        result: {
          ...result,
          time: Date.now() - start,
        },
      });
    } catch (error: any) {
      this.logger.error("MongoBucket error", error);
      throw new MongoBucketError("Unable to delete file", { error });
    }
  }

  public async download(filename: string): Promise<FileDownload> {
    try {
      const file = await this.findOneByFilenameOrFail(filename);
      const stream = this.grid.openDownloadStreamByName(filename);

      return { ...file, stream };
    } catch (error: any) {
      this.logger.error("MongoBucket error", error);
      throw new MongoBucketError("Error downloading file", {
        data: { filename },
        error,
      });
    }
  }

  public async find(criteria?: Filter<F>, options?: FindOptions<F>): Promise<Array<F>> {
    const start = Date.now();

    try {
      const filter = this.parseFilter(criteria);
      const result = await this.collection.find(filter, options).toArray();

      this.logger.debug("Bucket done: find", {
        input: {
          criteria,
          filter,
          options,
        },
        result: {
          count: result.length,
          time: Date.now() - start,
        },
      });

      return result.map((document) => this.create(document));
    } catch (error: any) {
      this.logger.error("MongoBucket error", error);
      throw new MongoBucketError("Unable to find files", { error });
    }
  }

  public async findOne(criteria: Filter<F>, options?: FindOptions<F>): Promise<F | null> {
    const start = Date.now();

    try {
      const filter = this.parseFilter(criteria);
      const document = await this.collection.findOne(filter, options);

      this.logger.debug("Bucket done: findOne", {
        input: {
          criteria,
          filter,
          options,
        },
        result: {
          document,
          time: Date.now() - start,
        },
      });

      if (!document) return null;

      return this.create(document);
    } catch (error: any) {
      this.logger.error("MongoBucket error", error);
      throw new MongoBucketError("Unable to find file", { error });
    }
  }

  public async findOneOrFail(criteria: Filter<F>, options?: FindOptions<F>): Promise<F> {
    const document = await this.findOne(criteria, options);

    if (!document) {
      throw new MongoBucketError("File not found", { debug: { criteria, options } });
    }

    return document;
  }

  public async findOneByFilename(filename: string): Promise<F | null> {
    return this.findOne({ filename } as any);
  }

  public async findOneByFilenameOrFail(filename: string): Promise<F> {
    return this.findOneOrFail({ filename } as any);
  }

  public async upload(stream: Readable, metadata: FileMetadata<F>): Promise<F> {
    this.logger.debug("Uploading file", { metadata });

    this.validateMetadata(metadata);

    try {
      const filename = randomUUID();
      const upload = this.grid.openUploadStream(filename, { metadata });

      stream.pipe(upload);

      this.logger.debug("File upload stream initialised", { filename });

      await new Promise<void>((resolve, reject) => {
        upload.once("finish", resolve);
        upload.once("error", reject);
      });

      const { done, state, gridFSFile } = upload;

      if (!done) {
        throw new Error("File upload not done");
      }

      if (!gridFSFile) {
        throw new Error("GridFSFile not initialized");
      }

      const { length, chunkSize, uploadDate } = gridFSFile;

      this.logger.error("Bucket done: upload", {
        chunkSize,
        done,
        length,
        metadata,
        state,
        uploadDate,
      });

      return await this.findOneByFilenameOrFail(filename);
    } catch (error: any) {
      this.logger.error("Error uploading file", error);

      throw new MongoBucketError("Error uploading file", { error });
    }
  }

  // private

  private create(document: GridFSDocument): F {
    const file = new this.FileConstructor(document.metadata);

    file.chunkSize = document.chunkSize;
    file.filename = document.filename;
    file.length = document.length;
    file.mimeType = document.metadata.mimeType;
    file.originalName = document.metadata.originalName;
    file.uploadDate = document.uploadDate;

    this.logger.debug("Created file", { file });

    return file;
  }

  private parseFilter(criteria: Filter<any> = {}): Filter<any> {
    const parsed: Dict = {};

    for (const [key, value] of Object.entries(criteria)) {
      if (
        key === "chunkSize" ||
        key === "filename" ||
        key === "length" ||
        key === "uploadDate"
      ) {
        parsed[key] = value;
        continue;
      }

      parsed[`metadata.${key}`] = value;
    }

    this.logger.debug("Parsed criteria", { criteria, parsed });

    return parsed;
  }

  private validateMetadata(metadata: FileMetadata<F>): void {
    if (!this.validate) return;

    this.validate(metadata);
  }

  // private static

  private static createBucketName<F extends IMongoFile>(
    options: MongoBucketOptions<F>,
  ): string {
    const nsp = options.namespace ? `${snakeCase(options.namespace)}_` : "";
    const name = snakeCase(options.File.name);

    return `${nsp}${name}`;
  }

  private static createCollectionName<F extends IMongoFile>(
    options: MongoBucketOptions<F>,
  ): string {
    return `${MongoBucket.createBucketName(options)}.files`;
  }
}
