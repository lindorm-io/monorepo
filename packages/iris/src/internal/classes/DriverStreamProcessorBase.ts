import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisNotSupportedError } from "../../errors/IrisNotSupportedError.js";
import type {
  IIrisStreamPipeline,
  IIrisStreamProcessor,
  IMessage,
} from "../../interfaces/index.js";
import type { IrisHookMeta } from "../../types/iris-hook-meta.js";
import type { DeadLetterManager } from "../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../delay/DelayManager.js";
import type { MessageEncryptionContext } from "../message/types/encryption-context.js";
import type { PipelineStage } from "../types/pipeline-stage.js";
import type { DriverStreamPipelineBaseSettings } from "./DriverStreamPipelineBase.js";

export type DriverStreamProcessorBaseSettings<State> = {
  state: State;
  logger: ILogger;
  stages?: Array<PipelineStage>;
  meta?: IrisHookMeta;
  encryption?: MessageEncryptionContext;
  inputClass?: Constructor<IMessage>;
  inputTopic?: string;
  deadLetterManager?: DeadLetterManager;
  delayManager?: DelayManager;
};

/**
 * The fully-resolved option set handed to a driver's `buildPipeline` hook once
 * the terminal `to()` call has collapsed the builder chain. It is the pipeline
 * base's option shape plus the driver-specific shared `state`, so a driver whose
 * pipeline ctor matches exactly can forward it verbatim.
 */
export type StreamPipelineBuildOptions<State> = DriverStreamPipelineBaseSettings & {
  state: State;
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
  protected readonly meta: IrisHookMeta | undefined;
  protected readonly encryption: MessageEncryptionContext | undefined;
  protected readonly inputClass: Constructor<IMessage> | undefined;
  protected readonly inputTopic: string | undefined;
  protected readonly deadLetterManager: DeadLetterManager | undefined;
  protected readonly delayManager: DelayManager | undefined;

  constructor(options: DriverStreamProcessorBaseSettings<State>) {
    this.state = options.state;
    this.logger = options.logger;
    this.stages = options.stages ?? [];
    this.meta = options.meta;
    this.encryption = options.encryption;
    this.inputClass = options.inputClass;
    this.inputTopic = options.inputTopic;
    this.deadLetterManager = options.deadLetterManager;
    this.delayManager = options.delayManager;
  }

  /**
   * Build a fresh processor-options object carrying every field forward, so the
   * builder methods (`from`/`filter`/`map`/…) only override what they change and
   * the dead-letter/delay managers always propagate to the pipeline.
   */
  private forkOptions(
    overrides: Partial<DriverStreamProcessorBaseSettings<State>>,
  ): DriverStreamProcessorBaseSettings<State> {
    return {
      state: this.state,
      logger: this.logger,
      stages: [...this.stages],
      meta: this.meta,
      encryption: this.encryption,
      inputClass: this.inputClass,
      inputTopic: this.inputTopic,
      deadLetterManager: this.deadLetterManager,
      delayManager: this.delayManager,
      ...overrides,
    };
  }

  /**
   * Clone this processor with the forked options. Every driver's processor is
   * constructed identically from `DriverStreamProcessorBaseSettings`, so the base
   * re-instantiates the concrete subclass via its own constructor — no per-driver
   * override is needed.
   */
  protected createSelf(
    options: DriverStreamProcessorBaseSettings<State>,
  ): DriverStreamProcessorBase<State, Pipeline, any, any> {
    const Ctor = this.constructor as new (
      options: DriverStreamProcessorBaseSettings<State>,
    ) => DriverStreamProcessorBase<State, Pipeline, any, any>;
    return new Ctor(options);
  }

  /**
   * Construct the driver's concrete `*StreamPipeline` from the resolved build
   * options. This is the only per-driver seam: the driver names its pipeline
   * class and adapts the option shape (e.g. memory renames `state`→`store`,
   * rabbit drops the Iris managers in favour of native DLX/TTL).
   */
  protected abstract buildPipeline(options: StreamPipelineBuildOptions<State>): Pipeline;

  from<T extends IMessage>(
    inputClass: Constructor<T>,
    options?: { topic?: string },
  ): IIrisStreamProcessor<T, Out> {
    return this.createSelf(
      this.forkOptions({ inputClass, inputTopic: options?.topic }),
    ) as unknown as IIrisStreamProcessor<T, Out>;
  }

  filter(predicate: (message: In) => boolean): IIrisStreamProcessor<In, Out> {
    return this.createSelf(
      this.forkOptions({ stages: [...this.stages, { type: "filter", predicate }] }),
    ) as unknown as IIrisStreamProcessor<In, Out>;
  }

  map<T extends IMessage>(transform: (message: In) => T): IIrisStreamProcessor<T, Out> {
    return this.createSelf(
      this.forkOptions({ stages: [...this.stages, { type: "map", transform }] }),
    ) as unknown as IIrisStreamProcessor<T, Out>;
  }

  flatMap<T extends IMessage>(
    transform: (message: In) => Array<T>,
  ): IIrisStreamProcessor<T, Out> {
    return this.createSelf(
      this.forkOptions({ stages: [...this.stages, { type: "flatMap", transform }] }),
    ) as unknown as IIrisStreamProcessor<T, Out>;
  }

  batch(
    size: number,
    options?: { timeout?: number },
  ): IIrisStreamProcessor<Array<In>, Out> {
    if (this.stages.some((s) => s.type === "batch")) {
      throw new IrisNotSupportedError(
        "Only one batch stage is allowed per stream processor",
        {
          code: "duplicate_batch_stage",
          title: "Duplicate Batch Stage",
          details:
            "The stream processor already contains a batch stage. Only one batch stage is permitted per processor pipeline.",
        },
      );
    }
    return this.createSelf(
      this.forkOptions({
        stages: [...this.stages, { type: "batch", size, timeout: options?.timeout }],
      }),
    ) as unknown as IIrisStreamProcessor<Array<In>, Out>;
  }

  to(outputClass: new (...args: any[]) => Out, options?: { topic?: string }): Pipeline {
    return this.buildPipeline({
      state: this.state,
      logger: this.logger,
      stages: this.stages,
      inputClass: this.inputClass,
      inputTopic: this.inputTopic,
      outputClass,
      outputTopic: options?.topic,
      meta: this.meta,
      encryption: this.encryption,
      deadLetterManager: this.deadLetterManager,
      delayManager: this.delayManager,
    });
  }
}
