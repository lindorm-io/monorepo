import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventSetState {
  public constructor(public readonly input: string) {}
}
