import React, { useState, useEffect } from 'react';
import {
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  Box,
  Paper,
  Modal,
} from '@mui/material';

interface EULADialogProps {
  open: boolean;
  onAccept: () => void;
}

const EULADialog: React.FC<EULADialogProps> = ({ open, onAccept }) => {
  const [agreed, setAgreed] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  useEffect(() => {
    // Debug logging for production
    console.log('EULA Dialog mounted, open state:', open);
    
    // Force focus to modal when opened
    if (open) {
      setTimeout(() => {
        const modalElement = document.getElementById('eula-modal-container');
        if (modalElement) {
          console.log('Modal element found, focusing...');
          modalElement.focus();
        }
      }, 100);
    }
  }, [open]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    if (isAtBottom && !scrolledToBottom) {
      setScrolledToBottom(true);
    }
  };

  const handleAccept = () => {
    if (agreed) {
      // Store acceptance in localStorage
      localStorage.setItem('eulaAccepted', 'true');
      localStorage.setItem('eulaAcceptedDate', new Date().toISOString());
      onAccept();
    }
  };

  // If not open, don't render anything
  if (!open) return null;

  // Use a simple fullscreen overlay approach for better Electron compatibility
  return (
    <Box
      id="eula-modal-container"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999, // Very high z-index to ensure it's on top
      }}
      tabIndex={-1}
    >
      <Paper
        elevation={24}
        sx={{
          width: '90%',
          maxWidth: 800,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h5" fontWeight={600}>
            End User License Agreement
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Please read and accept the terms to continue
          </Typography>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            p: 3,
            overflowY: 'auto',
            backgroundColor: 'grey.50',
            '&::-webkit-scrollbar': {
              width: 8,
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'grey.200',
              borderRadius: 4,
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'grey.400',
              borderRadius: 4,
              '&:hover': {
                backgroundColor: 'grey.500',
              },
            },
          }}
          onScroll={handleScroll}
        >
          <Typography variant="h6" gutterBottom>
            ANAVA VISION END USER LICENSE AGREEMENT
          </Typography>
          
          <Typography variant="body2" paragraph>
            Last Updated: {new Date().toLocaleDateString()}
          </Typography>

          <Typography variant="body2" paragraph>
            IMPORTANT: BY CLICKING "I ACCEPT", DOWNLOADING, INSTALLING, OR USING THE SOFTWARE, 
            YOU AGREE TO BE BOUND BY THE TERMS OF THIS AGREEMENT. IF YOU DO NOT AGREE TO THE 
            TERMS OF THIS AGREEMENT, DO NOT DOWNLOAD, INSTALL, OR USE THE SOFTWARE.
          </Typography>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3, fontWeight: 600 }}>
            1. LICENSE GRANT
          </Typography>
          <Typography variant="body2" paragraph>
            Subject to the terms of this Agreement, Anava Inc. ("Anava") grants you a limited, 
            non-exclusive, non-transferable license to install and use the Anava Vision software 
            ("Software") for evaluation and production purposes.
          </Typography>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3, fontWeight: 600 }}>
            2. TRIAL LICENSE
          </Typography>
          <Typography variant="body2" paragraph>
            The trial license key provided allows you to use the Software for evaluation purposes. 
            Trial licenses are limited in duration and functionality as determined by Anava.
          </Typography>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3, fontWeight: 600 }}>
            3. RESTRICTIONS
          </Typography>
          <Typography variant="body2" paragraph>
            You may not: (a) modify, reverse engineer, or decompile the Software; (b) remove any 
            proprietary notices; (c) use the Software for any unlawful purpose; (d) share or 
            transfer your license key to any third party.
          </Typography>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3, fontWeight: 600 }}>
            4. DATA COLLECTION AND PRIVACY
          </Typography>
          <Typography variant="body2" paragraph>
            The Software may collect usage data and analytics to improve our services. Camera 
            footage and AI analysis results remain on your premises unless you explicitly choose 
            to use cloud services. For full privacy details, see our Privacy Policy.
          </Typography>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3, fontWeight: 600 }}>
            5. DISCLAIMER OF WARRANTIES
          </Typography>
          <Typography variant="body2" paragraph>
            THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. ANAVA DISCLAIMS ALL 
            WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION THE IMPLIED WARRANTIES 
            OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
          </Typography>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3, fontWeight: 600 }}>
            6. LIMITATION OF LIABILITY
          </Typography>
          <Typography variant="body2" paragraph>
            IN NO EVENT SHALL ANAVA BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR 
            CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE OR INABILITY TO USE THE SOFTWARE.
          </Typography>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3, fontWeight: 600 }}>
            7. TERMINATION
          </Typography>
          <Typography variant="body2" paragraph>
            This Agreement is effective until terminated. Your rights under this Agreement will 
            terminate automatically without notice if you fail to comply with any term of this 
            Agreement.
          </Typography>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3, fontWeight: 600 }}>
            8. GOVERNING LAW
          </Typography>
          <Typography variant="body2" paragraph>
            This Agreement shall be governed by the laws of the State of California, USA, without 
            regard to its conflict of law provisions.
          </Typography>

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3, fontWeight: 600 }}>
            9. ENTIRE AGREEMENT
          </Typography>
          <Typography variant="body2" paragraph>
            This Agreement constitutes the entire agreement between you and Anava regarding the 
            Software and supersedes all prior agreements and understandings.
          </Typography>

          <Typography variant="body2" sx={{ mt: 4, fontStyle: 'italic' }}>
            For questions about this Agreement, please contact legal@anava.com
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ p: 3, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  disabled={!scrolledToBottom}
                />
              }
              label={
                <Typography variant="body2">
                  I have read and accept the terms of this agreement
                </Typography>
              }
            />
            {!scrolledToBottom && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block' }}>
                Please scroll to the bottom to enable acceptance
              </Typography>
            )}
          </Box>
          
          <Button
            variant="contained"
            onClick={handleAccept}
            disabled={!agreed || !scrolledToBottom}
            sx={{ minWidth: 120 }}
          >
            I Accept
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default EULADialog;