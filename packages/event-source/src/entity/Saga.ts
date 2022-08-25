import Joi from "joi";
import { Command, DomainEvent, TimeoutMessage } from "../message";
import { ILogger } from "@lindorm-io/winston";
import { IllegalEntityChangeError, SagaDestroyedError } from "../error";
import { JOI_MESSAGE } from "../schema";
import { assertSnakeCase, assertSchema } from "../util";
import { cloneDeep, merge, set, snakeCase } from "lodash";
import {
  AggregateIdentifier,
  DtoClass,
  ISaga,
  SagaData,
  SagaDispatchOptions,
  SagaOptions,
  State,
} from "../types";
import { randomString } from "@lindorm-io/core";

export class Saga<TState extends State = State> implements ISaga {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _hash: string;
  private readonly _messagesToDispatch: Array<Command | TimeoutMessage>;
  private readonly _processedCausationIds: Array<string>;
  private readonly _revision: number;
  private readonly _state: TState;
  private _destroyed: boolean;

  private readonly logger: ILogger;

  public constructor(options: SagaOptions<TState>, logger: ILogger) {
    this.logger = logger.createChildLogger(["Saga"]);

    assertSnakeCase(options.context);
    assertSnakeCase(options.name);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this._destroyed = options.destroyed || false;
    this._hash = options.hash || randomString(16);
    this._messagesToDispatch = options.messagesToDispatch || [];
    this._processedCausationIds = options.processedCausationIds || [];
    this._revision = options.revision || 0;
    this._state = options.state || ({} as unknown as TState);
  }

  // public properties

  public get destroyed(): boolean {
    return this._destroyed;
  }
  public set destroyed(_) {
    throw new IllegalEntityChangeError();
  }

  public get hash(): string {
    return this._hash;
  }
  public set hash(_) {
    throw new IllegalEntityChangeError();
  }

  public get messagesToDispatch(): Array<Command> {
    return this._messagesToDispatch;
  }
  public set messagesToDispatch(_) {
    throw new IllegalEntityChangeError();
  }

  public get processedCausationIds(): Array<string> {
    return this._processedCausationIds;
  }
  public set processedCausationIds(_) {
    throw new IllegalEntityChangeError();
  }

  public get revision(): number {
    return this._revision;
  }
  public set revision(_) {
    throw new IllegalEntityChangeError();
  }

  public get state(): Record<string, any> {
    return this._state;
  }
  public set state(_) {
    throw new IllegalEntityChangeError();
  }

  // public

  public toJSON(): SagaData {
    return {
      id: this.id,
      name: this.name,
      context: this.context,
      destroyed: this.destroyed,
      hash: this.hash,
      messagesToDispatch: cloneDeep(this.messagesToDispatch),
      processedCausationIds: cloneDeep(this.processedCausationIds),
      revision: this.revision,
      state: cloneDeep(this.state),
    };
  }

  // public context

  public destroy(): void {
    this.logger.debug("Destroy");

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._destroyed = true;
  }

  public dispatch(
    causation: DomainEvent,
    command: DtoClass,
    options: SagaDispatchOptions = {},
  ): void {
    this.logger.debug("Dispatch", { causation, command, options });

    assertSchema(
      Joi.object()
        .keys({
          causation: JOI_MESSAGE.required(),
          command: Joi.object().required(),
          options: Joi.object<SagaDispatchOptions>()
            .keys({
              aggregate: Joi.object<AggregateIdentifier>()
                .keys({
                  id: Joi.string().guid().optional(),
                  name: Joi.string().optional(),
                  context: Joi.string().optional(),
                })
                .optional(),
              delay: Joi.number().optional(),
              mandatory: Joi.boolean().optional(),
            })
            .optional(),
        })
        .required()
        .validate({ causation, command, options }),
    );

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    const { ...data } = command;

    this._messagesToDispatch.push(
      new Command(
        merge(
          {
            aggregate: causation.aggregate,
            correlationId: causation.correlationId,
            origin: "saga",
            originId: causation.originId,
          },
          {
            name: snakeCase(command.constructor.name),
            data,
            ...options,
          },
        ),
      ),
    );
  }

  public getState(): TState {
    return cloneDeep(this._state);
  }

  public mergeState(data: Record<string, any>): void {
    this.logger.debug("Merge state", { data });

    assertSchema(
      Joi.object()
        .keys({
          data: Joi.object().required(),
        })
        .required()
        .validate({ data }),
    );

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    merge(this._state, data);
  }

  public setState(path: string, value: any): void {
    this.logger.debug("Set state", { path, value });

    assertSchema(
      Joi.object()
        .keys({
          path: Joi.string().required(),
          value: Joi.any().required(),
        })
        .required()
        .validate({ path, value }),
    );

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    set(this._state, path, value);
  }

  public timeout(
    causation: DomainEvent,
    name: string,
    data: Record<string, any>,
    delay: number,
  ): void {
    this.logger.debug("Dispatch timeout", { causation, name, data, delay });

    assertSchema(
      Joi.object()
        .keys({
          causation: JOI_MESSAGE.required(),
          name: Joi.string().required(),
          data: Joi.object().required(),
          delay: Joi.number().required(),
        })
        .required()
        .validate({ causation, name, data, delay }),
    );

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._messagesToDispatch.push(
      new TimeoutMessage(
        {
          aggregate: {
            id: this.id,
            name: this.name,
            context: this.context,
          },
          name,
          data,
          delay,
          origin: "saga",
          originId: causation.originId,
        },
        causation,
      ),
    );
  }
}
