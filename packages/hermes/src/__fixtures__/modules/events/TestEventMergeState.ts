import { Event } from "../../../decorators";

@Event()
export class TestEventMergeState {
  public constructor(public readonly input: any) {}
}
