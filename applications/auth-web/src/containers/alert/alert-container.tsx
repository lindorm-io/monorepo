import { FunctionComponent } from "react";
import { useAlertContext } from "../../context/alert-provider";
import { Alert, Slide, Snackbar } from "@mui/material";

export const AlertContainer: FunctionComponent = () => {
  const { duration, open, severity, text, closeAlert } = useAlertContext();

  if (!open) {
    return <></>;
  }

  return (
    <Snackbar
      TransitionComponent={(props) => (
        <Slide
          {...props}
          direction="up"
        />
      )}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      autoHideDuration={duration}
      onClose={closeAlert}
      open={open}
      sx={{
        maxWidth: "95%",
      }}
    >
      <Alert
        severity={severity}
        onClose={closeAlert}
      >
        {text}
      </Alert>
    </Snackbar>
  );
};
