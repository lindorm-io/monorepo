import Joi from "joi";
import { AggregateIdentifier, ISaga, SagaData, SagaDispatchOptions, SagaOptions } from "../types";
import { Command, DomainEvent, TimeoutEvent } from "../message";
import { IllegalEntityChangeError, SagaDestroyedError } from "../error";
import { JOI_MESSAGE } from "../constant";
import { Logger } from "@lindorm-io/winston";
import { assertCamelCase, assertSchema } from "../util";
import { cloneDeep, merge, set } from "lodash";

export class Saga implements ISaga {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _causationList: Array<string>;
  private readonly _messagesToDispatch: Array<Command | TimeoutEvent>;
  private readonly _revision: number;
  private readonly _state: Record<string, any>;
  private _destroyed: boolean;

  private readonly logger: Logger;

  public constructor(options: SagaOptions, logger: Logger) {
    this.logger = logger.createChildLogger(["Saga"]);

    assertCamelCase(options.name);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this._causationList = options.causationList || [];
    this._destroyed = options.destroyed || false;
    this._messagesToDispatch = options.messagesToDispatch || [];
    this._revision = options.revision || 0;
    this._state = options.state || {};
  }

  // public properties

  public get causationList(): Array<string> {
    return this._causationList;
  }
  public set causationList(_) {
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
      causationList: cloneDeep(this.causationList),
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
      new TimeoutEvent(
        {
          aggregate: {
            id: this.id,
            name: this.name,
            context: this.context,
          },
          name,
          data,
          delay,
        },
        causation,
      ),
    );
  }
}
