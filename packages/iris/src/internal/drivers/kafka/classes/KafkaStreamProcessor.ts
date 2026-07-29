import type { IMessage } from "../../../../interfaces/index.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseSettings,
  type StreamPipelineBuildOptions,
} from "../../../classes/DriverStreamProcessorBase.js";
import { KafkaStreamPipeline } from "./KafkaStreamPipeline.js";

export type KafkaStreamProcessorSettings =
  DriverStreamProcessorBaseSettings<KafkaSharedState>;

export class KafkaStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<KafkaSharedState, KafkaStreamPipeline, In, Out> {
  protected buildPipeline(
    options: StreamPipelineBuildOptions<KafkaSharedState>,
  ): KafkaStreamPipeline {
    return new KafkaStreamPipeline(options);
  }
}
