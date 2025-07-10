import { Timeout } from "../../../decorators";

@Timeout()
export class TestTimeoutDispatch {
  public constructor(public readonly input: any) {}
}
