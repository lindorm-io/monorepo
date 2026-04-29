import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventCreate {
  public constructor(public readonly input: string) {}
}
