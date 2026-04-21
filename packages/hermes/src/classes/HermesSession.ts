import type { IIrisWorkerQueue } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { ClassLike, Constructor, Dict } from "@lindorm/types";
import { LindormError } from "@lindorm/errors";
import { randomUUID } from "@lindorm/random";
import { HandlerNotRegisteredError } from "../errors/index.js";
import type { IHermesSession } from "../interfaces/IHermesSession.js";
import type { AggregateIdentifier } from "../types/aggregate-identifier.js";
import type { HermesStatus } from "../types/hermes-status.js";
import { ViewDomain } from "../internal/domains/index.js";
import { HermesCommandMessage } from "../internal/messages/index.js";
import type { HermesRegistry } from "../internal/registry/index.js";
import { extractDto } from "../internal/utils/index.js";

type StatusRef = { current: HermesStatus };

export type HermesSessionOptions = {
  logger: ILogger;
  statusRef: StatusRef;
  registry: HermesRegistry;
  viewDomain: ViewDomain;
  commandQueue: IIrisWorkerQueue<HermesCommandMessage>;
};

/**
 * Lightweight, request-scoped session of a Hermes instance.
 *
 * Shares the parent's domains, queues, and registry but carries its own logger.
 * Sessions are ephemeral command/query handles — no lifecycle or admin methods.
 */
export class HermesSession implements IHermesSession {
  private readonly logger: ILogger;
  private readonly _statusRef: StatusRef;
  private readonly registry: HermesRegistry;
  private readonly viewDomain: ViewDomain;
  private readonly commandQueue: IIrisWorkerQueue<HermesCommandMessage>;

  public constructor(options: HermesSessionOptions) {
    this.logger = options.logger.child(["HermesSession"]);
    this._statusRef = options.statusRef;
    this.registry = options.registry;
    this.viewDomain = options.viewDomain;
    this.commandQueue = options.commandQueue;
  }

  // -- Data access --

  public get status(): HermesStatus {
    return this._statusRef.current;
  }

  public async command(
    command: ClassLike,
    options: { id?: string; correlationId?: string; delay?: number; meta?: Dict } = {},
  ): Promise<AggregateIdentifier> {
    this.assertReady();

    const metadata = this.registry.getCommand(command.constructor as Constructor);
    const commandHandler = this.registry.getCommandHandler(
      command.constructor as Constructor,
    );

    if (!commandHandler) {
      throw new HandlerNotRegisteredError();
    }

    const aggregate: AggregateIdentifier = {
      id: options.id || randomUUID(),
      name: commandHandler.aggregate.name,
      namespace: commandHandler.aggregate.namespace,
    };

    const { name, version } = metadata;
    const { data: dtoData } = extractDto(command);
    const { correlationId, delay, meta = {} } = options;

    const id = randomUUID();

    const message = this.commandQueue.create({
      id,
      aggregate,
      causationId: id,
      correlationId: correlationId ?? null,
      data: dtoData,
      meta,
      name,
      version,
    } as Partial<HermesCommandMessage>);

    this.logger.verbose("Publishing command", {
      command: name,
      aggregate,
    });

    await this.commandQueue.publish(message, delay ? { delay } : undefined);

    return aggregate;
  }

  public async query<R>(query: ClassLike): Promise<R> {
    this.assertReady();

    return this.viewDomain.query<R>(query);
  }

  // -- Guard --

  private assertReady(): void {
    if (this._statusRef.current !== "ready") {
      throw new LindormError("Hermes is not ready", {
        data: { status: this._statusRef.current },
      });
    }
  }
}
