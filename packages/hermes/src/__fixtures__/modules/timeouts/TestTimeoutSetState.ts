import { Timeout } from "../../../decorators";

@Timeout()
export class TestTimeoutSetState {
  public constructor(public readonly input: any) {}
}
