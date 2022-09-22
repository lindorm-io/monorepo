import { ConfirmKey } from "./configuration";

export type InitialiseStrategyResponse = {
  id: string;
  display_code?: string;
  confirm_key: ConfirmKey;
  expires_in: number;
  polling_required: boolean;
  qr_code?: string;
  strategy_session_token: string | null;
};
