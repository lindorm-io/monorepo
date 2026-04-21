import { Event } from "../../../decorators/index.js";

@Event()
export class TestEventDispatch {
  public constructor(public readonly input: string) {}
}
