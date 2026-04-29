import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../../../interfaces/index.js";
import type { IrisHookMeta } from "../../../../types/index.js";
import type { NatsSharedState } from "../types/nats-types.js";
import type { PipelineStage } from "../../../types/pipeline-stage.js";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseOptions,
} from "../../../classes/DriverStreamProcessorBase.js";
import { NatsStreamPipeline } from "./NatsStreamPipeline.js";

export type NatsStreamProcessorOptions =
  DriverStreamProcessorBaseOptions<NatsSharedState>;

export class NatsStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<NatsSharedState, NatsStreamPipeline, In, Out> {
  protected createSelf(
    options: DriverStreamProcessorBaseOptions<NatsSharedState>,
  ): NatsStreamProcessor<any, any> {
    return new NatsStreamProcessor(options);
  }

  protected createPipeline(options: {
    state: NatsSharedState;
    logger: ILogger;
    stages: Array<PipelineStage>;
    inputClass?: Constructor<IMessage>;
    inputTopic?: string;
    outputClass: Constructor<IMessage>;
    outputTopic?: string;
    meta?: IrisHookMeta;
    amphora?: unknown;
  }): NatsStreamPipeline {
    return new NatsStreamPipeline({
      state: options.state,
      logger: options.logger,
      stages: options.stages,
      inputClass: options.inputClass,
      inputTopic: options.inputTopic,
      outputClass: options.outputClass,
      outputTopic: options.outputTopic,
      meta: options.meta,
      amphora: options.amphora,
    });
  }
}
