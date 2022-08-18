import Joi from "joi";
import { Command, DomainEvent, TimeoutMessage } from "../message";
import { ILogger } from "@lindorm-io/winston";
import { IllegalEntityChangeError, SagaDestroyedError } from "../error";
import { JOI_MESSAGE } from "../schema";
import { assertSnakeCase, assertSchema } from "../util";
import { cloneDeep, merge, set } from "lodash";
import {
  AggregateIdentifier,
  ISaga,
  SagaData,
  SagaDispatchOptions,
  SagaOptions,
  State,
} from "../types";

export class Saga<S extends State = State> implements ISaga {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _processedCausationIds: Array<string>;
  private readonly _messagesToDispatch: Array<Command | TimeoutMessage>;
  private readonly _revision: number;
  private readonly _state: S;
  private _destroyed: boolean;

  private readonly logger: ILogger;

  public constructor(options: SagaOptions<S>, logger: ILogger) {
    this.logger = logger.createChildLogger(["Saga"]);

    assertSnakeCase(options.context);
    assertSnakeCase(options.name);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this._processedCausationIds = options.processedCausationIds || [];
    this._destroyed = options.destroyed || false;
    this._messagesToDispatch = options.messagesToDispatch || [];
    this._revision = options.revision || 0;
    this._state = options.state || ({} as unknown as S);
  }

  // public properties

  public get processedCausationIds(): Array<string> {
    return this._processedCausationIds;
  }
  public set processedCausationIds(_) {
    throw new IllegalEntityChangeError();
  }

  public get messagesToDispatch(): Array<Command> {
    return this._messagesToDispatch;
  }
  public set messagesToDispatch(_) {
    throw new IllegalEntityChangeError();
  }

  public get destroyed(): boolean {
    return this._destroyed;
  }
  public set destroyed(_) {
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
      processedCausationIds: cloneDeep(this.processedCausationIds),
      destroyed: this.destroyed,
      messagesToDispatch: cloneDeep(this.messagesToDispatch),
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
    name: string,
    data: Record<string, any>,
    options: SagaDispatchOptions = {},
  ): void {
    this.logger.debug("Dispatch", { causation, name, data, options });

    assertSchema(
      Joi.object()
        .keys({
          causation: JOI_MESSAGE.required(),
          name: Joi.string().required(),
          data: Joi.object().required(),
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
        .validate({ causation, name, data, options }),
    );

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._messagesToDispatch.push(
      new Command(
        merge(
          {
            aggregate: causation.aggregate,
            correlationId: causation.correlationId,
            origin: "saga",
            originator: causation.originator,
          },
          {
            name,
            data,
            ...options,
          },
        ),
      ),
    );
  }

  public getState(): S {
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
          originator: causation.originator,
        },
        causation,
      ),
    );
  }
}
