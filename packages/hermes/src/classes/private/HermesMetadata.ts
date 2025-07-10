/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { Dict } from "@lindorm/types";
import {
  MetaAggregate,
  MetaCommand,
  MetaEvent,
  MetaHandler,
  MetaQuery,
  MetaSaga,
  MetaTimeout,
  MetaView,
  WithHandlers,
} from "../../types";

type InternalArray =
  | "aggregates"
  | "commands"
  | "events"
  | "handlers"
  | "queries"
  | "sagas"
  | "timeouts"
  | "views";

export class HermesMetadata {
  private readonly aggregates: Array<MetaAggregate>;
  private readonly commands: Array<MetaCommand>;
  private readonly events: Array<MetaEvent>;
  private readonly handlers: Array<MetaHandler>;
  private readonly queries: Array<MetaQuery>;
  private readonly sagas: Array<MetaSaga>;
  private readonly timeouts: Array<MetaTimeout>;
  private readonly views: Array<MetaView>;

  public constructor() {
    this.aggregates = [];
    this.commands = [];
    this.events = [];
    this.handlers = [];
    this.queries = [];
    this.sagas = [];
    this.timeouts = [];
    this.views = [];
  }

  // add

  public addAggregate(metadata: MetaAggregate): void {
    if (this.aggregates.some((m) => m.target === metadata.target)) return;
    this.addMetadata("aggregates", metadata);
  }

  public addCommand(metadata: MetaCommand): void {
    if (this.commands.some((m) => m.target === metadata.target)) return;
    this.addMetadata("commands", metadata);
  }

  public addEvent(metadata: MetaEvent): void {
    if (this.events.some((m) => m.target === metadata.target)) return;
    this.addMetadata("events", metadata);
  }

  public addHandler(metadata: MetaHandler): void {
    if (
      this.handlers.some(
        (m) =>
          m.target === metadata.target &&
          m.trigger === metadata.trigger &&
          m.decorator === metadata.decorator,
      )
    ) {
      return;
    }
    this.addMetadata("handlers", metadata);
  }

  public addQuery(metadata: MetaQuery): void {
    if (this.queries.some((m) => m.target === metadata.target)) return;
    this.addMetadata("queries", metadata);
  }

  public addSaga(metadata: MetaSaga): void {
    if (this.sagas.some((m) => m.target === metadata.target)) return;
    this.addMetadata("sagas", metadata);
  }

  public addTimeout(metadata: MetaTimeout): void {
    if (this.timeouts.some((m) => m.target === metadata.target)) return;
    this.addMetadata("timeouts", metadata);
  }

  public addView(metadata: MetaView): void {
    if (this.views.some((m) => m.target === metadata.target)) return;
    this.addMetadata("views", metadata);
  }

  // get dtos

  public getCommand(Ctor: Function): MetaCommand | undefined {
    const [command] = this.getMeta<MetaCommand>(Ctor, "commands");
    if (!command) return;
    return command;
  }

  public getEvent(Ctor: Function): MetaEvent | undefined {
    const [event] = this.getMeta<MetaEvent>(Ctor, "events");
    if (!event) return;
    return event;
  }

  public getQuery(Ctor: Function): MetaQuery | undefined {
    const [query] = this.getMeta<MetaQuery>(Ctor, "queries");
    if (!query) return;
    return query;
  }

  public getTimeout(Ctor: Function): MetaTimeout | undefined {
    const [timeout] = this.getMeta<MetaTimeout>(Ctor, "timeouts");
    if (!timeout) return;
    return timeout;
  }

  // get models

  public getAggregate(Ctor: Function): WithHandlers<MetaAggregate> | undefined {
    return this.getWithHandlers<MetaAggregate>(Ctor, "aggregates");
  }

  public getSaga(Ctor: Function): WithHandlers<MetaSaga> | undefined {
    return this.getWithHandlers<MetaSaga>(Ctor, "sagas");
  }

  public getView(Ctor: Function): WithHandlers<MetaView> | undefined {
    return this.getWithHandlers<MetaView>(Ctor, "views");
  }

  // find

  public findCommand(name: string): MetaCommand | undefined {
    return this.commands.find((meta) => meta.name === name);
  }

  public findEvent(name: string, version: number): MetaEvent | undefined {
    return this.events.find((meta) => meta.name === name && meta.version === version);
  }

  public findQuery(name: string): MetaQuery | undefined {
    return this.queries.find((meta) => meta.name === name);
  }

  public findTimeout(name: string): MetaTimeout | undefined {
    return this.timeouts.find((meta) => meta.name === name);
  }

  // private

  private addMetadata(key: InternalArray, metadata: any): void {
    this[key].push(metadata);
  }

  private getMeta<T>(target: Function, arr: InternalArray): Array<T> {
    const collected: Array<any> = [];

    let current: any = target;

    while (current && current !== Function.prototype) {
      collected.push(...this[arr].filter((meta: any) => meta.target === current));
      current = Object.getPrototypeOf(current);
    }

    return collected;
  }

  private getWithHandlers<T extends Dict>(
    Ctor: Function,
    arr: InternalArray,
  ): WithHandlers<T> | undefined {
    const [item] = this.getMeta<T>(Ctor, arr);

    if (!item) return;

    const handlers = this.getMeta<MetaHandler>(Ctor, "handlers");

    return { ...item, handlers };
  }
}
