/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { MessageMetadataError } from "../../errors";
import {
  MessageMetadata,
  MetaField,
  MetaFieldDecorator,
  MetaGenerated,
  MetaHook,
  MetaMessage,
  MetaSchema,
} from "../../types";

type Cache = {
  target: Function;
  metadata: MessageMetadata;
};

type InternalArray = "fields" | "generated" | "hooks" | "messages" | "schemas";

const UNIQUE_FIELDS: Array<MetaFieldDecorator> = [
  // special
  "CorrelationField",
  "DelayField",
  "IdentifierField",
  "MandatoryField",
  "PersistentField",
  "PriorityField",
  // date
  "TimestampField",
];

export class GlobalMessageMetadata {
  private readonly cache: Array<Cache>;

  private readonly fields: Array<MetaField>;
  private readonly generated: Array<MetaGenerated>;
  private readonly hooks: Array<MetaHook>;
  private readonly messages: Array<MetaMessage>;
  private readonly schemas: Array<MetaSchema>;

  public constructor() {
    this.cache = [];

    this.fields = [];
    this.generated = [];
    this.hooks = [];
    this.messages = [];
    this.schemas = [];
  }

  // public

  public addField<T extends MetaFieldDecorator = MetaFieldDecorator>(
    metadata: MetaField<T>,
  ): void {
    this.addMetadata("fields", metadata);
  }

  public addGenerated(metadata: MetaGenerated): void {
    this.addMetadata("generated", metadata);
  }

  public addHook(metadata: MetaHook): void {
    this.addMetadata("hooks", metadata);
  }

  public addMessage(metadata: MetaMessage): void {
    this.addMetadata("messages", metadata);
  }

  public addSchema(metadata: MetaSchema): void {
    this.addMetadata("schemas", metadata);
  }

  public get<T extends MetaFieldDecorator = MetaFieldDecorator>(
    target: Function,
  ): MessageMetadata<T> {
    const cached = this.getCache<T>(target);
    if (cached) return cached;

    const [foundMessage] = this.getMeta<MetaMessage>(target, "messages");

    if (!foundMessage) {
      throw new MessageMetadataError("Message metadata not found", {
        debug: { Message: target.name },
      });
    }

    const { target: _, ...message } = foundMessage;

    const fields = this.getMeta<MetaField<T>>(target, "fields").map(
      ({ target: _, ...rest }) => rest,
    );
    const generated = this.getMeta<MetaGenerated>(target, "generated").map(
      ({ target: _, ...rest }) => rest,
    );
    const hooks = this.getMeta<MetaHook>(target, "hooks").map(
      ({ target: _, ...rest }) => rest,
    );
    const schemas = this.getMeta<MetaSchema>(target, "schemas").map(
      ({ target: _, schema }) => schema,
    );

    for (const field of fields) {
      if (fields.filter((a) => a.key === field.key).length > 1) {
        throw new MessageMetadataError("Duplicate field metadata", {
          debug: { Message: target.name, field: field.key },
        });
      }

      const decorator = field.decorator as MetaFieldDecorator;

      if (
        UNIQUE_FIELDS.includes(decorator) &&
        fields.filter((a) => a.decorator === decorator).length > 1
      ) {
        throw new MessageMetadataError(`Duplicate ${decorator} metadata`, {
          debug: { Message: target.name, field: field.key },
        });
      }

      if (decorator === "Field" && field.type === "enum" && !field.enum) {
        throw new MessageMetadataError("@Field enum type requires an enum option", {
          debug: { Message: target.name, field: field.key },
        });
      }
    }

    for (const generate of generated) {
      if (fields.find((a) => a.key === generate.key)) continue;
      throw new MessageMetadataError("Generated metadata without field", {
        debug: { Message: target.name, field: generate.key },
      });
    }

    const final: MessageMetadata<T> = {
      fields,
      message,
      generated,
      hooks,
      schemas,
    };

    this.setCache(target, final);

    return final;
  }

  // private

  private addMetadata(key: InternalArray, metadata: any): void {
    this[key].push(metadata);
  }

  private getCache<T extends MetaFieldDecorator = MetaFieldDecorator>(
    target: Function,
  ): MessageMetadata<T> | undefined {
    return this.cache.find((item) => item.target === target)
      ?.metadata as MessageMetadata<T>;
  }

  private getMeta<T>(target: Function, key: InternalArray): Array<T> {
    const collected: Array<any> = [];

    let current: any = target;

    while (current && current !== Function.prototype) {
      collected.push(...this[key].filter((meta: any) => meta.target === current));
      current = Object.getPrototypeOf(current);
    }

    return collected;
  }

  private setCache(target: Function, metadata: MessageMetadata): void {
    this.cache.push({ target, metadata });
  }
}
