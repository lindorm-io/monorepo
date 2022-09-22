import { ChangeEvt } from "../../types/evt";
import { ConfirmKey } from "../../types/configuration";
import { FunctionComponent } from "react";
import { OtpInputField } from "../input/otp-input-field";
import { PasswordInputField } from "../input/password-input-field";

type Props = {
  confirmKey: ConfirmKey;
  disabled: boolean;
  value: string;
  onChange(evt: ChangeEvt): void;
  onChangeAutomaticConfirm(evt: ChangeEvt): void;
};

export const ConfirmationInputField: FunctionComponent<Props> = ({
  confirmKey,
  disabled,
  value,
  onChange,
  onChangeAutomaticConfirm,
}) => {
  switch (confirmKey) {
    case "challenge_confirmation_token":
    case "none":
      return <></>;

    case "code":
    case "password":
      return (
        <PasswordInputField
          disabled={disabled}
          value={value}
          onChange={onChange}
        />
      );

    case "otp":
    case "totp":
      return (
        <OtpInputField
          disabled={disabled}
          value={value}
          onChange={onChangeAutomaticConfirm}
        />
      );

    default:
      return <></>;
  }
};
