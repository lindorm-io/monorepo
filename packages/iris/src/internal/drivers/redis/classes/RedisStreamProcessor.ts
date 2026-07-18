import type { IMessage } from "../../../../interfaces/index.js";
import type { RedisSharedState } from "../types/redis-types.js";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseOptions,
  type StreamPipelineBuildOptions,
} from "../../../classes/DriverStreamProcessorBase.js";
import { RedisStreamPipeline } from "./RedisStreamPipeline.js";

export type RedisStreamProcessorOptions =
  DriverStreamProcessorBaseOptions<RedisSharedState>;

export class RedisStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<RedisSharedState, RedisStreamPipeline, In, Out> {
  protected buildPipeline(
    options: StreamPipelineBuildOptions<RedisSharedState>,
  ): RedisStreamPipeline {
    return new RedisStreamPipeline(options);
  }
}
