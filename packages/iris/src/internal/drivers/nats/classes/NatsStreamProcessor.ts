import type { IMessage } from "../../../../interfaces/index.js";
import type { NatsSharedState } from "../types/nats-types.js";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseSettings,
  type StreamPipelineBuildOptions,
} from "../../../classes/DriverStreamProcessorBase.js";
import { NatsStreamPipeline } from "./NatsStreamPipeline.js";

export type NatsStreamProcessorSettings =
  DriverStreamProcessorBaseSettings<NatsSharedState>;

export class NatsStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<NatsSharedState, NatsStreamPipeline, In, Out> {
  protected buildPipeline(
    options: StreamPipelineBuildOptions<NatsSharedState>,
  ): NatsStreamPipeline {
    return new NatsStreamPipeline(options);
  }
}
