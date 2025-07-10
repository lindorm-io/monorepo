import { Event } from "../../../decorators";

@Event()
export class TestEventSetState {
  public constructor(public readonly input: any) {}
}
