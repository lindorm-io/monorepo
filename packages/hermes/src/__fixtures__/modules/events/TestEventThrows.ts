import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventThrows {
  public constructor(public readonly input: string) {}
}
