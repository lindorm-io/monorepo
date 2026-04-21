import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../../../interfaces/index.js";
import type { MemorySharedState } from "../types/memory-store.js";
import type { PipelineStage } from "../../../types/pipeline-stage.js";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseOptions,
} from "../../../classes/DriverStreamProcessorBase.js";
import { MemoryStreamPipeline } from "./MemoryStreamPipeline.js";

export type MemoryStreamProcessorOptions =
  DriverStreamProcessorBaseOptions<MemorySharedState>;

export class MemoryStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<MemorySharedState, MemoryStreamPipeline, In, Out> {
  protected createSelf(
    options: DriverStreamProcessorBaseOptions<MemorySharedState>,
  ): MemoryStreamProcessor<any, any> {
    return new MemoryStreamProcessor(options);
  }

  protected createPipeline(options: {
    state: MemorySharedState;
    logger: ILogger;
    stages: Array<PipelineStage>;
    inputClass?: Constructor<IMessage>;
    inputTopic?: string;
    outputClass: Constructor<IMessage>;
    outputTopic?: string;
    context?: unknown;
    amphora?: unknown;
  }): MemoryStreamPipeline {
    return new MemoryStreamPipeline({
      store: options.state,
      logger: options.logger,
      stages: options.stages,
      inputClass: options.inputClass,
      inputTopic: options.inputTopic,
      outputClass: options.outputClass,
      outputTopic: options.outputTopic,
      context: options.context,
      amphora: options.amphora,
    });
  }
}
