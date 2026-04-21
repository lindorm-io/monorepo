import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../../../interfaces/index.js";
import type { RedisSharedState } from "../types/redis-types.js";
import type { PipelineStage } from "../../../types/pipeline-stage.js";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseOptions,
} from "../../../classes/DriverStreamProcessorBase.js";
import { RedisStreamPipeline } from "./RedisStreamPipeline.js";

export type RedisStreamProcessorOptions =
  DriverStreamProcessorBaseOptions<RedisSharedState>;

export class RedisStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<RedisSharedState, RedisStreamPipeline, In, Out> {
  protected createSelf(
    options: DriverStreamProcessorBaseOptions<RedisSharedState>,
  ): RedisStreamProcessor<any, any> {
    return new RedisStreamProcessor(options);
  }

  protected createPipeline(options: {
    state: RedisSharedState;
    logger: ILogger;
    stages: Array<PipelineStage>;
    inputClass?: Constructor<IMessage>;
    inputTopic?: string;
    outputClass: Constructor<IMessage>;
    outputTopic?: string;
    context?: unknown;
    amphora?: unknown;
  }): RedisStreamPipeline {
    return new RedisStreamPipeline({
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
