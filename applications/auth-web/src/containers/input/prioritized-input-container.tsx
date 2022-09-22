import { AuthenticationStrategy } from "../../enum/AuthenticationStrategy";
import { ChangeEvt } from "../../types/evt";
import { FunctionComponent, ReactElement, useCallback, useEffect, useState } from "react";
import { PrioritizedInputButton } from "../../components/aggregates/prioritized-input-button";
import { PrioritizedInputField } from "../../components/aggregates/prioritized-input-field";
import { AuthenticationMethod } from "../../enum/AuthenticationMethod";
import { ClientConfig, InitialiseKey } from "../../types/configuration";

type Props = {
  clientConfig: Array<ClientConfig>;
  defaultValue: string;
  loading: AuthenticationStrategy | null;
  selectedMethod: AuthenticationMethod;
  onClick(strategy: AuthenticationStrategy, initialiseKey: InitialiseKey, value: string): void;
};

export const PrioritizedInputContainer: FunctionComponent<Props> = ({
  clientConfig,
  defaultValue,
  loading,
  selectedMethod,
  onClick,
}) => {
  const prioritized = clientConfig.find((config) => config.method === selectedMethod);
  const [value, setValue] = useState("");

  const onChange = useCallback((evt: ChangeEvt) => setValue(evt.target.value), [setValue]);

  useEffect(() => {
    if (!defaultValue) return;
    setValue(defaultValue);
  }, [defaultValue]);

  return (
    <>
      <PrioritizedInputField
        clientConfig={prioritized!}
        value={value}
        onChange={onChange}
      />
      <PrioritizedInputButton
        clientConfig={prioritized!}
        loading={loading}
        value={value}
        onClick={onClick}
      />
    </>
  );
};
