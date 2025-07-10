import { Event } from "../../../decorators";

@Event()
export class TestEventDispatch {
  public constructor(public readonly input: any) {}
}
