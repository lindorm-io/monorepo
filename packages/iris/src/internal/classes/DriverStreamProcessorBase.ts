import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisNotSupportedError } from "../../errors/IrisNotSupportedError";
import type {
  IIrisStreamPipeline,
  IIrisStreamProcessor,
  IMessage,
} from "../../interfaces";
import type { PipelineStage } from "../types/pipeline-stage";

export type DriverStreamProcessorBaseOptions<State> = {
  state: State;
  logger: ILogger;
  stages?: Array<PipelineStage>;
  context?: unknown;
  amphora?: unknown;
  inputClass?: Constructor<IMessage>;
  inputTopic?: string;
};

export abstract class DriverStreamProcessorBase<
  State,
  Pipeline extends IIrisStreamPipeline,
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> implements IIrisStreamProcessor<In, Out> {
  protected readonly state: State;
  protected readonly logger: ILogger;
  protected readonly stages: Array<PipelineStage>;
  protected readonly context: unknown;
  protected readonly amphora: unknown;
  protected readonly inputClass: Constructor<IMessage> | undefined;
  protected readonly inputTopic: string | undefined;

  public constructor(options: DriverStreamProcessorBaseOptions<State>) {
    this.state = options.state;
    this.logger = options.logger;
    this.stages = options.stages ?? [];
    this.context = options.context;
    this.amphora = options.amphora;
    this.inputClass = options.inputClass;
    this.inputTopic = options.inputTopic;
  }

  protected abstract createSelf(
    options: DriverStreamProcessorBaseOptions<State>,
  ): DriverStreamProcessorBase<State, Pipeline, any, any>;

  protected abstract createPipeline(options: {
    state: State;
    logger: ILogger;
    stages: Array<PipelineStage>;
    inputClass?: Constructor<IMessage>;
    inputTopic?: string;
    outputClass: Constructor<IMessage>;
    outputTopic?: string;
    context?: unknown;
    amphora?: unknown;
  }): Pipeline;

  public from<T extends IMessage>(
    inputClass: Constructor<T>,
    options?: { topic?: string },
  ): IIrisStreamProcessor<T, Out> {
    return this.createSelf({
      state: this.state,
      logger: this.logger,
      stages: [...this.stages],
      context: this.context,
      amphora: this.amphora,
      inputClass,
      inputTopic: options?.topic,
    }) as unknown as IIrisStreamProcessor<T, Out>;
  }

  public filter(predicate: (message: In) => boolean): IIrisStreamProcessor<In, Out> {
    return this.createSelf({
      state: this.state,
      logger: this.logger,
      stages: [...this.stages, { type: "filter", predicate }],
      context: this.context,
      amphora: this.amphora,
      inputClass: this.inputClass,
      inputTopic: this.inputTopic,
    }) as unknown as IIrisStreamProcessor<In, Out>;
  }

  public map<T extends IMessage>(
    transform: (message: In) => T,
  ): IIrisStreamProcessor<T, Out> {
    return this.createSelf({
      state: this.state,
      logger: this.logger,
      stages: [...this.stages, { type: "map", transform }],
      context: this.context,
      amphora: this.amphora,
      inputClass: this.inputClass,
      inputTopic: this.inputTopic,
    }) as unknown as IIrisStreamProcessor<T, Out>;
  }

  public flatMap<T extends IMessage>(
    transform: (message: In) => Array<T>,
  ): IIrisStreamProcessor<T, Out> {
    return this.createSelf({
      state: this.state,
      logger: this.logger,
      stages: [...this.stages, { type: "flatMap", transform }],
      context: this.context,
      amphora: this.amphora,
      inputClass: this.inputClass,
      inputTopic: this.inputTopic,
    }) as unknown as IIrisStreamProcessor<T, Out>;
  }

  public batch(
    size: number,
    options?: { timeout?: number },
  ): IIrisStreamProcessor<Array<In>, Out> {
    if (this.stages.some((s) => s.type === "batch")) {
      throw new IrisNotSupportedError(
        "Only one batch stage is allowed per stream processor",
      );
    }
    return this.createSelf({
      state: this.state,
      logger: this.logger,
      stages: [...this.stages, { type: "batch", size, timeout: options?.timeout }],
      context: this.context,
      amphora: this.amphora,
      inputClass: this.inputClass,
      inputTopic: this.inputTopic,
    }) as unknown as IIrisStreamProcessor<Array<In>, Out>;
  }

  public to(
    outputClass: new (...args: any[]) => Out,
    options?: { topic?: string },
  ): Pipeline {
    return this.createPipeline({
      state: this.state,
      logger: this.logger,
      stages: this.stages,
      inputClass: this.inputClass,
      inputTopic: this.inputTopic,
      outputClass,
      outputTopic: options?.topic,
      context: this.context,
      amphora: this.amphora,
    });
  }
}
