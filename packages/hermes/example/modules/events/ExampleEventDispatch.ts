import { Event } from "../../../src";

@Event()
export class ExampleEventDispatch {
  public constructor(public readonly input: any) {}
}
