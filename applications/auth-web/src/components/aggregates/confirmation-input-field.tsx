import { FunctionComponent } from "react";
import { InputKey, InputMode } from "../../types/configuration";
import { OtpInputField } from "../input/otp-input-field";
import { PasswordInputField } from "../input/password-input-field";

type Props = {
  disabled: boolean;
  inputKey: InputKey;
  inputLength: number | null;
  inputMode: InputMode;
  value: string;
  onChange(value: string): void;
  onChangeAutomaticConfirm(value: string): void;
};

export const ConfirmationInputField: FunctionComponent<Props> = ({
  disabled,
  inputKey,
  inputLength,
  inputMode,
  value,
  onChange,
  onChangeAutomaticConfirm,
}) => {
  console.log("*** ConfirmationInputField", { inputKey, disabled, value });
  switch (inputKey) {
    case "challenge_confirmation_token":
    case "none":
      return <></>;

    case "code":
    case "password":
      return (
        <PasswordInputField
          disabled={disabled}
          value={value}
          onChange={(evt) => onChange(evt.target.value)}
        />
      );

    case "otp":
    case "totp":
      return (
        <OtpInputField
          TextFieldsProps={{ disabled }}
          inputMode={inputMode}
          length={inputLength || 1}
          value={value}
          onChange={onChangeAutomaticConfirm}
        />
      );

    default:
      return <></>;
  }
};
