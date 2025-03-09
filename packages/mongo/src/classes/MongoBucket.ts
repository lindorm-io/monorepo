import {
  defaultCreateEntity,
  defaultValidateEntity,
  getCollectionName,
  globalEntityMetadata,
} from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial, Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { DeleteOptions, Filter, FindOptions, GridFSBucket } from "mongodb";
import { Readable } from "stream";
import { FileExtra } from "../decorators";
import { MongoBucketError } from "../errors";
import { IMongoBucket, IMongoFile } from "../interfaces";
import { GridFSDocument } from "../interfaces/private";
import { FileDownload, FileUpload, MongoBucketOptions } from "../types";
import {
  getBucketChunkSize,
  getBucketCollectionName,
  getBucketMetadataIndexes,
  getIndexOptions,
} from "../utils/private";
import { MongoBase } from "./MongoBase";

export class MongoBucket<F extends IMongoFile>
  extends MongoBase<F>
  implements IMongoBucket<F>
{
  private readonly FileConstructor: Constructor<F>;
  private readonly bucketName: string;
  private readonly chunkSizeBytes: number | null;
  private _grid: GridFSBucket | undefined;

  protected readonly logger: ILogger;

  public constructor(options: MongoBucketOptions<F>) {
    const metadata = globalEntityMetadata.get<FileExtra>(options.File);
    const database = metadata.entity.database || options.database;

    if (!database) {
      throw new MongoBucketError("Database name not found", {
        debug: { metadata, options },
      });
    }

    super({
      client: options.client,
      collection: getBucketCollectionName(options.File, options),
      database,
      logger: options.logger,
      indexes: getIndexOptions({
        ...metadata,
        indexes: getBucketMetadataIndexes(metadata),
      }),
    });

    this.logger = options.logger.child(["MongoMongoBucket", options.File.name]);

    this.bucketName = getCollectionName(options.File, options);
    this.chunkSizeBytes = getBucketChunkSize(options, metadata);

    this.FileConstructor = options.File;
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

  public async download(filename: string): Promise<FileDownload<F>> {
    try {
      const file = await this.findOneOrFail({ filename } as any);
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

  public async upload(stream: Readable, metadata: FileUpload<F>): Promise<F> {
    this.logger.debug("Uploading file", { metadata });

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

      const file = await this.findOneOrFail({ filename } as any);

      try {
        this.validate(file);
      } catch (error: any) {
        this.logger.error("Error validating file", error);

        await this.grid.delete(upload.id);
        await this.collection.deleteOne({ _id: upload.id });

        throw new MongoBucketError("Error validating file", { error });
      }

      return file;
    } catch (error: any) {
      this.logger.error("Error uploading file", error);

      throw new MongoBucketError("Error uploading file", { error });
    }
  }

  // private

  private create(document: GridFSDocument): F {
    const { chunkSize, filename, length, uploadDate, metadata = {} } = document;

    const file = defaultCreateEntity<F>(this.FileConstructor, {
      chunkSize,
      filename,
      length,
      uploadDate,
      ...metadata,
    } as DeepPartial<F>);

    this.logger.debug("Created file", { file });

    return file;
  }

  private validate(file: F): void {
    defaultValidateEntity(this.FileConstructor, file);

    this.logger.debug("File validated", { file });
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
}
