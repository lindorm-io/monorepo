import { AlertColor } from '@mui/material';

export const getDuration = (severity: AlertColor): number => {
  switch (severity) {
    case 'error':
      return 15000;

    case 'warning':
      return 10000;

    case 'info':
      return 5000;

    case 'success':
      return 1000;

    default:
      return 6000;
  }
};
