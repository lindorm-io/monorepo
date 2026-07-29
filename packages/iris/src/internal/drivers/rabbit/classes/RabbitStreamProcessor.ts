import type { IMessage } from "../../../../interfaces/index.js";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseSettings,
  type StreamPipelineBuildOptions,
} from "../../../classes/DriverStreamProcessorBase.js";
import { RabbitStreamPipeline } from "./RabbitStreamPipeline.js";

export type RabbitStreamProcessorSettings =
  DriverStreamProcessorBaseSettings<RabbitSharedState>;

export class RabbitStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<RabbitSharedState, RabbitStreamPipeline, In, Out> {
  protected buildPipeline(
    options: StreamPipelineBuildOptions<RabbitSharedState>,
  ): RabbitStreamPipeline {
    // RabbitMQ uses native DLX/TTL for retry + dead-letter, so the Iris
    // dead-letter/delay managers are intentionally not threaded into the pipeline.
    const { deadLetterManager, delayManager, ...pipelineOptions } = options;
    return new RabbitStreamPipeline(pipelineOptions);
  }
}
