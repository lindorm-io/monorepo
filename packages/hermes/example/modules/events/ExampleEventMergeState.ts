import { Event } from "../../../src";

@Event()
export class ExampleEventMergeState {
  public constructor(public readonly input: any) {}
}
