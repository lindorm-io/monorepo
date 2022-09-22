import { FunctionComponent, useState } from "react";
import { OtpInputField } from "../../components/input/otp-input-field";

type Props = {
  onSubmit(value: string): void;
};

export const OtpInputContainer: FunctionComponent<Props> = ({ onSubmit }) => {
  const [value, setValue] = useState("");

  return (
    <OtpInputField
      value={value}
      onChange={setValue}
      onComplete={onSubmit}
    />
  );
};
