import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../../../interfaces";
import type { RabbitSharedState } from "../types/rabbit-types";
import type { PipelineStage } from "../../../types/pipeline-stage";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseOptions,
} from "../../../classes/DriverStreamProcessorBase";
import { RabbitStreamPipeline } from "./RabbitStreamPipeline";

export type RabbitStreamProcessorOptions =
  DriverStreamProcessorBaseOptions<RabbitSharedState>;

export class RabbitStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<RabbitSharedState, RabbitStreamPipeline, In, Out> {
  protected createSelf(
    options: DriverStreamProcessorBaseOptions<RabbitSharedState>,
  ): RabbitStreamProcessor<any, any> {
    return new RabbitStreamProcessor(options);
  }

  protected createPipeline(options: {
    state: RabbitSharedState;
    logger: ILogger;
    stages: Array<PipelineStage>;
    inputClass?: Constructor<IMessage>;
    inputTopic?: string;
    outputClass: Constructor<IMessage>;
    outputTopic?: string;
    context?: unknown;
    amphora?: unknown;
  }): RabbitStreamPipeline {
    return new RabbitStreamPipeline({
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
