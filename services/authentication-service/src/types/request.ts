import { FlowType } from "../enum";

export interface InitialiseFlowRequestData {
  email?: string;
  flowType: FlowType;
  nonce?: string;
  phoneNumber?: string;
  username?: string;
}
