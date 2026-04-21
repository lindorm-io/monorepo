import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../../../interfaces/index.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import type { PipelineStage } from "../../../types/pipeline-stage.js";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseOptions,
} from "../../../classes/DriverStreamProcessorBase.js";
import { KafkaStreamPipeline } from "./KafkaStreamPipeline.js";

export type KafkaStreamProcessorOptions =
  DriverStreamProcessorBaseOptions<KafkaSharedState>;

export class KafkaStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<KafkaSharedState, KafkaStreamPipeline, In, Out> {
  protected createSelf(
    options: DriverStreamProcessorBaseOptions<KafkaSharedState>,
  ): KafkaStreamProcessor<any, any> {
    return new KafkaStreamProcessor(options);
  }

  protected createPipeline(options: {
    state: KafkaSharedState;
    logger: ILogger;
    stages: Array<PipelineStage>;
    inputClass?: Constructor<IMessage>;
    inputTopic?: string;
    outputClass: Constructor<IMessage>;
    outputTopic?: string;
    context?: unknown;
    amphora?: unknown;
  }): KafkaStreamPipeline {
    return new KafkaStreamPipeline({
      state: options.state,
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
