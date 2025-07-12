/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { MessageMetadataError } from "../../errors";
import { IMessage } from "../../interfaces";
import {
  MessageMetadata,
  MetaField,
  MetaFieldDecorator,
  MetaGenerated,
  MetaHook,
  MetaMessage,
  MetaPriority,
  MetaSchema,
  MetaTopic,
} from "../../types";

type Cache = {
  target: Function;
  metadata: MessageMetadata;
};

type InternalArray =
  | "fields"
  | "generated"
  | "hooks"
  | "messages"
  | "priorities"
  | "schemas"
  | "topics";

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
  private readonly priorities: Array<MetaPriority>;
  private readonly schemas: Array<MetaSchema>;
  private readonly topics: Array<MetaTopic>;

  public constructor() {
    this.cache = [];

    this.fields = [];
    this.generated = [];
    this.hooks = [];
    this.messages = [];
    this.priorities = [];
    this.schemas = [];
    this.topics = [];
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

  public addHook<M extends IMessage>(metadata: MetaHook<M>): void {
    this.addMetadata("hooks", metadata);
  }

  public addMessage(metadata: MetaMessage): void {
    this.addMetadata("messages", metadata);
  }

  public addPriority(metadata: MetaPriority): void {
    this.addMetadata("priorities", metadata);
  }

  public addSchema<M extends IMessage>(metadata: MetaSchema<M>): void {
    this.addMetadata("schemas", metadata);
  }

  public addTopic<M extends IMessage>(metadata: MetaTopic<M>): void {
    this.addMetadata("topics", metadata);
  }

  public get<
    M extends IMessage = IMessage,
    T extends MetaFieldDecorator = MetaFieldDecorator,
  >(target: Function): MessageMetadata<M, T> {
    const cached = this.getCache(target);

    if (cached) return cached as unknown as MessageMetadata<M, T>;

    const [message] = this.getMeta<MetaMessage>(target, "messages");

    if (!message) {
      throw new MessageMetadataError("Message metadata not found", {
        debug: { target: target.name },
      });
    }

    const [priority] = this.getMeta<MetaPriority>(target, "priorities").map(
      ({ target: _, priority }) => priority,
    );
    const [schema] = this.getMeta<MetaSchema>(target, "schemas").map(
      ({ target: _, schema }) => schema,
    );
    const [topic] = this.getMeta<MetaTopic>(target, "topics").map(
      ({ target: _, ...rest }) => rest,
    );

    const fields = this.getMeta<MetaField<T>>(target, "fields").map(
      ({ target: _, ...rest }) => rest,
    );
    const generated = this.getMeta<MetaGenerated>(target, "generated").map(
      ({ target: _, ...rest }) => rest,
    );
    const hooks = this.getMeta<MetaHook>(target, "hooks").map(
      ({ target: _, ...rest }) => rest,
    );

    for (const field of fields) {
      if (fields.filter((a) => a.key === field.key).length > 1) {
        throw new MessageMetadataError("Duplicate field metadata", {
          debug: { target: target.name, field: field.key },
        });
      }

      const decorator = field.decorator as MetaFieldDecorator;

      if (
        UNIQUE_FIELDS.includes(decorator) &&
        fields.filter((a) => a.decorator === decorator).length > 1
      ) {
        throw new MessageMetadataError(`Duplicate ${decorator} metadata`, {
          debug: { target: target.name, field: field.key },
        });
      }

      if (decorator === "Field" && field.type === "enum" && !field.enum) {
        throw new MessageMetadataError("@Field enum type requires an enum option", {
          debug: { target: target.name, field: field.key },
        });
      }
    }

    for (const generate of generated) {
      if (fields.find((a) => a.key === generate.key)) continue;
      throw new MessageMetadataError("Generated metadata without field", {
        debug: { target: target.name, field: generate.key },
      });
    }

    const final: MessageMetadata = {
      fields,
      message,
      generated,
      hooks,
      priority,
      schema,
      topic,
    };

    this.setCache(target, final);

    return final as unknown as MessageMetadata<M, T>;
  }

  public find<
    M extends IMessage = IMessage,
    T extends MetaFieldDecorator = MetaFieldDecorator,
  >(name: string): MessageMetadata<M, T> | undefined {
    const found = this.messages.find((m) => m.name === name);

    if (!found) return;

    return this.get<M, T>(found.target);
  }

  // private

  private addMetadata(key: InternalArray, metadata: any): void {
    this[key].push(metadata);
  }

  private getCache(target: Function): MessageMetadata | undefined {
    return this.cache.find((item) => item.target === target)?.metadata as MessageMetadata;
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
