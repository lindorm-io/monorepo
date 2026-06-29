import type { IIrisWorkerQueue } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { ClassLike, Constructor, Dict } from "@lindorm/types";
import { LindormError } from "@lindorm/errors";
import { randomId } from "@lindorm/random";
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

  constructor(options: HermesSessionOptions) {
    this.logger = options.logger.child(["HermesSession"]);
    this._statusRef = options.statusRef;
    this.registry = options.registry;
    this.viewDomain = options.viewDomain;
    this.commandQueue = options.commandQueue;
  }

  // -- Data access --

  get status(): HermesStatus {
    return this._statusRef.current;
  }

  async command(
    command: ClassLike,
    options: { id?: string; correlationId?: string; delay?: number; meta?: Dict } = {},
  ): Promise<AggregateIdentifier> {
    this.assertReady();

    const metadata = this.registry.getCommand(command.constructor as Constructor);
    const commandHandler = this.registry.getCommandHandler(
      command.constructor as Constructor,
    );

    if (!commandHandler) {
      throw new HandlerNotRegisteredError("Command handler has not been registered", {
        code: "command_handler_not_registered",
        title: "Command Handler Not Registered",
        details: `No command handler is registered for command "${metadata.name}" (version ${metadata.version}).`,
        data: { command: metadata.name, version: metadata.version },
      });
    }

    const aggregate: AggregateIdentifier = {
      id: options.id || randomId({ namespace: "agg" }),
      name: commandHandler.aggregate.name,
      namespace: commandHandler.aggregate.namespace,
    };

    const { name, version } = metadata;
    const { data: dtoData } = extractDto(command);
    const { correlationId, delay, meta = {} } = options;

    const id = randomId({ namespace: "cmd" });

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

  async query<R>(query: ClassLike): Promise<R> {
    this.assertReady();

    return this.viewDomain.query<R>(query);
  }

  // -- Guard --

  private assertReady(): void {
    if (this._statusRef.current !== "ready") {
      throw new LindormError("Hermes is not ready", {
        code: "not_ready",
        title: "Hermes Not Ready",
        details: `Hermes must reach the "ready" status before handling requests; current status is "${this._statusRef.current}".`,
        type: "urn:lindorm:hermes:error:not_ready",
        data: { status: this._statusRef.current },
      });
    }
  }
}
