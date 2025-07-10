import { Event } from "../../../src";

@Event()
export class ExampleEventSetState {
  public constructor(public readonly input: any) {}
}
