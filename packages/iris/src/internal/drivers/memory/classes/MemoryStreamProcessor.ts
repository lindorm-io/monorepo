import type { IMessage } from "../../../../interfaces/index.js";
import type { MemorySharedState } from "../types/memory-store.js";
import {
  DriverStreamProcessorBase,
  type DriverStreamProcessorBaseSettings,
  type StreamPipelineBuildOptions,
} from "../../../classes/DriverStreamProcessorBase.js";
import { MemoryStreamPipeline } from "./MemoryStreamPipeline.js";

export type MemoryStreamProcessorSettings =
  DriverStreamProcessorBaseSettings<MemorySharedState>;

export class MemoryStreamProcessor<
  In extends IMessage = IMessage,
  Out extends IMessage = IMessage,
> extends DriverStreamProcessorBase<MemorySharedState, MemoryStreamPipeline, In, Out> {
  protected buildPipeline(
    options: StreamPipelineBuildOptions<MemorySharedState>,
  ): MemoryStreamPipeline {
    // Memory's pipeline names the shared state `store`; managers still thread through.
    const { state, ...rest } = options;
    return new MemoryStreamPipeline({ ...rest, store: state });
  }
}
