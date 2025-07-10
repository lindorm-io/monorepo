import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { AggregateDomain, ChecksumDomain, SagaDomain, ViewDomain } from "../domains";
import { HermesStatus } from "../enums";
import {
  ChecksumStore,
  EncryptionStore,
  EventStore,
  MessageBus,
  SagaStore,
  ViewStore,
} from "../infrastructure";
import { IAggregateModel, IHermes, ISagaModel, IViewModel } from "../interfaces";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../messages";
import {
  AggregateIdentifier,
  CloneHermesOptions,
  EventEmitterListener,
  HermesAdmin,
  HermesCommandOptions,
  HermesInspectOptions,
  HermesOptions,
} from "../types";
import { FromClone } from "../types/private";
import { extractDataTransferObject } from "../utils/private";
import { HermesRegistry } from "./private";

export class Hermes implements IHermes {
  private readonly namespace: string;

  // domains
  private readonly aggregateDomain: AggregateDomain;
  private readonly checksumDomain: ChecksumDomain;
  private readonly sagaDomain: SagaDomain;
  private readonly viewDomain: ViewDomain;

  // infrastructure
  private readonly checksumStore: ChecksumStore;
  private readonly encryptionStore: EncryptionStore;
  private readonly eventStore: EventStore;
  private readonly sagaStore: SagaStore;
  private readonly viewStore: ViewStore;

  // messages
  private readonly commandBus: MessageBus<HermesCommand<Dict>>;
  private readonly errorBus: MessageBus<HermesError>;
  private readonly eventBus: MessageBus<HermesEvent<Dict>>;
  private readonly timeoutBus: MessageBus<HermesTimeout>;

  // primary
  private readonly registry: HermesRegistry;
  private readonly options: HermesOptions;
  private readonly logger: ILogger;

  private _status: HermesStatus;

  public constructor(options: HermesOptions);
  public constructor(options: FromClone);
  public constructor(options: HermesOptions | FromClone) {
    this.logger = options.logger.child(["Hermes"]);

    if ("_mode" in options && options._mode === "from_clone") {
      const opts = options as FromClone;

      this.aggregateDomain = opts.aggregateDomain;
      this.checksumDomain = opts.checksumDomain;
      this.sagaDomain = opts.sagaDomain;
      this.viewDomain = opts.viewDomain;

      this.checksumStore = opts.checksumStore;
      this.encryptionStore = opts.encryptionStore;
      this.eventStore = opts.eventStore;
      this.sagaStore = opts.sagaStore;
      this.viewStore = opts.viewStore;

      this.commandBus = opts.commandBus;
      this.errorBus = opts.errorBus;
      this.eventBus = opts.eventBus;
      this.timeoutBus = opts.timeoutBus;

      this.options = opts.options;
      this.registry = opts.registry;

      this.namespace = opts.namespace;
      this._status = opts.status;
    } else {
      const opts = options as HermesOptions;

      this.namespace = opts.namespace ?? "hermes";
      this._status = HermesStatus.Created;

      this.options = opts;
      this.registry = new HermesRegistry({ namespace: this.namespace });

      // infrastructure

      this.checksumStore = new ChecksumStore({
        ...this.options.checksumStore,
        logger: this.logger,
      });
      this.encryptionStore = new EncryptionStore({
        ...this.options.encryptionStore,
        logger: this.logger,
      });
      this.eventStore = new EventStore({
        ...this.options.eventStore,
        logger: this.logger,
      });
      this.sagaStore = new SagaStore({
        ...this.options.sagaStore,
        logger: this.logger,
      });
      this.viewStore = new ViewStore({
        ...this.options.viewStore,
        logger: this.logger,
      });

      this.commandBus = new MessageBus<HermesCommand<Dict>>({
        ...this.options.messageBus,
        Message: HermesCommand,
        logger: this.logger,
      });
      this.errorBus = new MessageBus<HermesError>({
        ...(this.options.messageBus as any),
        Message: HermesError,
        logger: this.logger,
      });
      this.eventBus = new MessageBus<HermesEvent<Dict>>({
        ...this.options.messageBus,
        Message: HermesEvent,
        logger: this.logger,
      });
      this.timeoutBus = new MessageBus<HermesTimeout>({
        ...this.options.messageBus,
        Message: HermesTimeout,
        logger: this.logger,
      });

      // domains

      this.aggregateDomain = new AggregateDomain({
        commandBus: this.commandBus,
        encryptionStore: this.encryptionStore,
        errorBus: this.errorBus,
        eventBus: this.eventBus,
        eventStore: this.eventStore,
        logger: this.logger,
        registry: this.registry,
      });
      this.checksumDomain = new ChecksumDomain({
        errorBus: this.errorBus,
        eventBus: this.eventBus,
        store: this.checksumStore,
        logger: this.logger,
        registry: this.registry,
      });
      this.sagaDomain = new SagaDomain({
        commandBus: this.commandBus,
        errorBus: this.errorBus,
        eventBus: this.eventBus,
        timeoutBus: this.timeoutBus,
        store: this.sagaStore,
        logger: this.logger,
        registry: this.registry,
      });
      this.viewDomain = new ViewDomain({
        ...this.options.viewStore,
        commandBus: this.commandBus,
        errorBus: this.errorBus,
        eventBus: this.eventBus,
        logger: this.logger,
        registry: this.registry,
        store: this.viewStore,
      });
    }
  }

  // public

  public get admin(): HermesAdmin {
    return {
      inspect: {
        aggregate: this.inspectAggregate.bind(this),
        saga: this.inspectSaga.bind(this),
        view: this.inspectView.bind(this),
      },
    };
  }

  public get status(): HermesStatus {
    return this._status;
  }

  public clone(options: CloneHermesOptions = {}): IHermes {
    return new Hermes({
      _mode: "from_clone",
      aggregateDomain: this.aggregateDomain,
      checksumDomain: this.checksumDomain,
      checksumStore: this.checksumStore,
      commandBus: this.commandBus,
      encryptionStore: this.encryptionStore,
      errorBus: this.errorBus,
      eventBus: this.eventBus,
      eventStore: this.eventStore,
      logger: options.logger ?? this.logger,
      namespace: this.namespace,
      options: this.options,
      registry: this.registry,
      sagaDomain: this.sagaDomain,
      sagaStore: this.sagaStore,
      status: this.status,
      timeoutBus: this.timeoutBus,
      viewDomain: this.viewDomain,
      viewStore: this.viewStore,
    });
  }

  public async command<M extends Dict = Dict>(
    Command: ClassLike,
    options: HermesCommandOptions<M> = {},
  ): Promise<AggregateIdentifier> {
    if (this.status !== HermesStatus.Ready) {
      throw new LindormError("Invalid operation", {
        data: { status: this.status },
      });
    }

    const { name, data } = extractDataTransferObject(Command);
    const { correlationId, delay, meta } = options;

    const metadata = this.registry.getCommand(Command.constructor);

    const aggregate: AggregateIdentifier = {
      id: data.aggregateId || options.id || randomUUID(),
      name: metadata.aggregate.name,
      context: metadata.aggregate.context,
    };

    const id = randomUUID();

    const command = this.commandBus.create({
      id,
      aggregate,
      causationId: id,
      correlationId,
      data,
      delay,
      meta,
      name,
    });

    this.logger.verbose("Publishing command", { command });

    await this.commandBus.publish(command);

    return aggregate;
  }

  public on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void {
    if (evt.startsWith("saga")) {
      this.sagaDomain.on(evt, listener);
    }

    if (evt.startsWith("view")) {
      this.viewDomain.on(evt, listener);
    }
  }

  public async query<R>(query: ClassLike): Promise<R> {
    return this.viewDomain.query(query);
  }

  public async setup(): Promise<void> {
    this._status = HermesStatus.Initialising;

    if (this.options.messageBus.rabbit) {
      await this.options.messageBus.rabbit.setup();
    }

    if (this.options.checksumStore.mongo) {
      await this.options.checksumStore.mongo.setup();
    }
    if (this.options.checksumStore.postgres) {
      await this.options.checksumStore.postgres.setup();
    }

    if (this.options.eventStore.mongo) {
      await this.options.eventStore.mongo.setup();
    }
    if (this.options.eventStore.postgres) {
      await this.options.eventStore.postgres.setup();
    }

    if (this.options.sagaStore.mongo) {
      await this.options.sagaStore.mongo.setup();
    }
    if (this.options.sagaStore.postgres) {
      await this.options.sagaStore.postgres.setup();
    }

    if (this.options.viewStore.mongo) {
      await this.options.viewStore.mongo.setup();
    }
    if (this.options.viewStore.postgres) {
      await this.options.viewStore.postgres.setup();
    }
    if (this.options.viewStore.redis) {
      await this.options.viewStore.redis.setup();
    }

    this.registry.add(this.options.modules);

    await this.aggregateDomain.registerHandlers();
    await this.checksumDomain.registerHandlers();
    await this.sagaDomain.registerHandlers();
    await this.viewDomain.registerHandlers();

    this._status = HermesStatus.Ready;
  }

  // private admin

  private async inspectAggregate<S extends Dict = Dict>(
    inspect: HermesInspectOptions,
  ): Promise<IAggregateModel<S>> {
    return this.aggregateDomain.inspect<S>({
      id: inspect.id,
      name: inspect.name,
      context: inspect.context ?? this.namespace,
    });
  }

  private async inspectSaga<S extends Dict = Dict>(
    inspect: HermesInspectOptions,
  ): Promise<ISagaModel<S>> {
    return this.sagaDomain.inspect<S>({
      id: inspect.id,
      name: inspect.name,
      context: inspect.context ?? this.namespace,
    });
  }

  private async inspectView<S extends Dict = Dict>(
    inspect: HermesInspectOptions,
  ): Promise<IViewModel<S>> {
    const viewIdentifier = {
      id: inspect.id,
      name: inspect.name,
      context: inspect.context ?? this.namespace,
    };

    const registry = this.registry.views.find(
      (v) => v.name === viewIdentifier.name && v.namespace === viewIdentifier.context,
    );

    if (!registry) {
      throw new Error(
        `View not found: ${viewIdentifier.name} (${viewIdentifier.context})`,
      );
    }

    return this.viewDomain.inspect<S>(viewIdentifier, registry.source);
  }
}
