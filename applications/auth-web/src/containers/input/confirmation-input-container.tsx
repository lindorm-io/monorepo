import { ChangeEvt } from "../../types/evt";
import { ConfirmationInputField } from "../../components/aggregates/confirmation-input-field";
import { FunctionComponent, useCallback, useState } from "react";
import { InitialiseStrategyResponse } from "../../types/initialise-strategy-response";
import { PrimaryActionButton } from "../../components/button/primary-action-button";
import { Box, Switch, Typography } from "@mui/material";

type Props = {
  loading: boolean;
  strategy: InitialiseStrategyResponse;
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

  return (
    <>
      <ConfirmationInputField
        confirmKey={strategy.confirm_key}
        disabled={loading}
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
