import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { z } from "zod";
import { IrisError } from "../../../errors/IrisError.js";
import { IrisSerializationError } from "../../../errors/IrisSerializationError.js";
import type { IMessage } from "../../../interfaces/index.js";
import type { IrisHookMeta } from "../../../types/iris-hook-meta.js";
import { createDefaultIrisHookMeta } from "../../../types/iris-hook-meta.js";
import { getMessageMetadata } from "../metadata/get-message-metadata.js";
import type { MessageMetadata } from "../types/metadata.js";
import { buildSchema } from "../utils/build-schema.js";
import { deserialise } from "../utils/deserialise.js";
import { generateFields } from "../utils/generate-fields.js";
import { parseField } from "../utils/parse-field.js";
import { runHooksAsync, runHooksSync } from "../utils/run-hooks.js";

const IDENTITY_DECORATORS = new Set(["IdentifierField", "TimestampField"]);

export type MessageManagerOptions<M extends IMessage> = {
  target: Constructor<M>;
  meta?: IrisHookMeta;
  logger?: ILogger;
};

export class MessageManager<M extends IMessage> {
  public readonly target: Constructor<M>;
  public readonly metadata: MessageMetadata;

  private readonly meta: IrisHookMeta;
  private readonly logger: ILogger | undefined;
  private _schemaCache: z.ZodType | undefined;

  public constructor(options: MessageManagerOptions<M>) {
    if (!options.target) {
      throw new IrisError("MessageManager requires a target constructor", {
        debug: { options },
      });
    }

    this.target = options.target;
    this.meta = options.meta ?? createDefaultIrisHookMeta();
    this.logger = options.logger?.child(["MessageManager"]);

    try {
      this.metadata = getMessageMetadata(this.target);
    } catch (error) {
      throw new IrisError(
        `Failed to retrieve metadata for message "${this.target.name}". Did you forget @Message()?`,
        {
          debug: { target: this.target.name },
          error: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  public create(options: Partial<M> = {} as Partial<M>): M {
    const message = new this.target() as any;

    for (const field of this.metadata.fields) {
      message[field.key] = parseField(field, message, options);
    }

    // Reset generated fields that weren't user-provided to null.
    // deserialise zero-coerces some types (integer -> 0, float -> 0, etc.)
    // which would cause generateFields to skip them.
    for (const gen of this.metadata.generated) {
      if ((options as any)[gen.key] != null) continue;
      message[gen.key] = null;
    }

    generateFields(this.metadata, message);

    runHooksSync("OnCreate", this.metadata.hooks, message, this.meta);

    this.logger?.silly("Created message", { message });

    return message;
  }

  public hydrate(data: Record<string, unknown>): M {
    const message = new this.target() as any;

    for (const field of this.metadata.fields) {
      const value = data[field.key];

      if (value === undefined) {
        message[field.key] = field.nullable
          ? null
          : typeof field.default === "function"
            ? field.default()
            : field.default;
        continue;
      }

      message[field.key] = deserialise(value, field.type);
    }

    // Apply @Transform.from for each field that has a transform
    for (const field of this.metadata.fields) {
      if (!field.transform) continue;
      try {
        message[field.key] = field.transform.from(message[field.key]);
      } catch (error) {
        throw new IrisSerializationError(
          `@Transform.from failed for field "${field.key}"`,
          {
            error: error instanceof Error ? error : undefined,
          },
        );
      }
    }

    runHooksSync("OnHydrate", this.metadata.hooks, message, this.meta);

    this.logger?.silly("Hydrated message", { message });

    return message;
  }

  public copy(source: M): M {
    const data: Record<string, unknown> = {};
    for (const field of this.metadata.fields) {
      if (IDENTITY_DECORATORS.has(field.decorator)) continue;
      data[field.key] = structuredClone((source as any)[field.key]);
    }

    // Remove generated fields so create() produces fresh values
    for (const gen of this.metadata.generated) {
      delete data[gen.key];
    }

    return this.create(data as Partial<M>);
  }

  public validate(message: M): void {
    if (!this._schemaCache) {
      this._schemaCache = buildSchema(this.metadata);
    }

    this._schemaCache.parse(message);

    runHooksSync("OnValidate", this.metadata.hooks, message, this.meta);

    this.logger?.silly("Validated message", { message });
  }

  // hooks — async lifecycle

  public async beforePublish(message: M): Promise<void> {
    await runHooksAsync("BeforePublish", this.metadata.hooks, message, this.meta);
  }

  public async afterPublish(message: M): Promise<void> {
    await runHooksAsync("AfterPublish", this.metadata.hooks, message, this.meta);
  }

  public async beforeConsume(message: M): Promise<void> {
    await runHooksAsync("BeforeConsume", this.metadata.hooks, message, this.meta);
  }

  public async afterConsume(message: M): Promise<void> {
    await runHooksAsync("AfterConsume", this.metadata.hooks, message, this.meta);
  }

  public async onConsumeError(error: Error, message: M): Promise<void> {
    await runHooksAsync("OnConsumeError", this.metadata.hooks, message, this.meta, error);
  }
}
