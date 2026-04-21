import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventDestroyNext {
  public constructor(public readonly input: string) {}
}
