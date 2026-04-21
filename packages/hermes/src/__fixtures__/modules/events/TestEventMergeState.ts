import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventMergeState {
  public constructor(public readonly input: string) {}
}
