import { Box, Switch, Typography } from "@mui/material";
import { ChangeEvt } from "../../types/evt";
import { ConfirmationInputField } from "../../components/aggregates/confirmation-input-field";
import { FunctionComponent, useCallback, useState } from "react";
import { PrimaryActionButton } from "../../components/button/primary-action-button";
import { StrategyConfig } from "../../types/configuration";

type Props = {
  loading: boolean;
  strategy: StrategyConfig;
  onConfirm(value: string, remember: boolean): void;
};

export const ConfirmationInputContainer: FunctionComponent<Props> = ({
  loading,
  strategy,
  onConfirm,
}) => {
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(false);

  const onChange = useCallback((value: string) => setValue(value), [setValue]);

  const onChangeAutomaticConfirm = useCallback(
    (value: string) => {
      setValue(value);

      if (value.length === 6) {
        onConfirm(value, remember);
      }
    },
    [strategy, remember, setValue, onConfirm],
  );

  const onSwitch = useCallback((evt: ChangeEvt) => setRemember(evt.target.checked), [setRemember]);

  const onSubmit = useCallback(() => {
    onConfirm(value, remember);
  }, [value, remember, onConfirm]);

  if (strategy.display_code) {
    return <Typography variant="h2">{strategy.display_code}</Typography>;
  }

  if (strategy.qr_code) {
    return <Typography variant="h2">{strategy.qr_code}</Typography>;
  }

  console.log("*** ConfirmationInputContainer", { strategy, loading, value });

  return (
    <>
      <ConfirmationInputField
        disabled={loading}
        inputKey={strategy.input_key}
        inputLength={strategy.input_length}
        inputMode={strategy.input_mode}
        value={value}
        onChange={onChange}
        onChangeAutomaticConfirm={onChangeAutomaticConfirm}
      />
      <Box
        alignItems="center"
        display="flex"
        justifyContent="space-between"
        width="100%"
      >
        <Typography>Remember sign in?</Typography>
        <Switch
          checked={remember}
          onChange={onSwitch}
        />
      </Box>
      <PrimaryActionButton
        loading={loading}
        onClick={onSubmit}
      >
        Submit
      </PrimaryActionButton>
    </>
  );
};
