import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';
import { Warning } from '@mui/icons-material';

interface NavigationWarningDialogProps {
  open: boolean;
  title?: string;
  message: string;
  severity?: 'warning' | 'error';
  confirmText?: string;
  cancelText?: string;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const NavigationWarningDialog: React.FC<NavigationWarningDialogProps> = ({
  open,
  title = 'Warning: Operation in Progress',
  message,
  severity = 'warning',
  confirmText = 'Leave Anyway',
  cancelText = 'Stay on Page',
  isProcessing = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog
      open={open}
      onClose={isProcessing ? undefined : onCancel}
      disableEscapeKeyDown={isProcessing}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Warning color={severity} />
        {title}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Alert severity={severity} sx={{ mb: 2 }}>
            {message}
          </Alert>
        </Box>
        <DialogContentText>
          If you leave this page now:
          <Box component="ul" sx={{ mt: 1, mb: 0 }}>
            <li>The current operation will be cancelled</li>
            <li>You will lose all progress</li>
            <li>You may need to start over from the beginning</li>
          </Box>
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={onCancel}
          variant="contained"
          color="primary"
          autoFocus
          disabled={isProcessing}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="outlined"
          color="error"
          disabled={isProcessing}
          startIcon={isProcessing ? <CircularProgress size={16} /> : null}
        >
          {isProcessing ? 'Cancelling...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NavigationWarningDialog;