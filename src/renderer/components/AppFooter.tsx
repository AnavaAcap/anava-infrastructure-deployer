import React from 'react';
import { Box, Typography, Link, Divider } from '@mui/material';
import { styled } from '@mui/material/styles';

const FooterContainer = styled(Box)(({ theme }) => ({
  marginTop: 'auto',
  padding: theme.spacing(3),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const FooterLinks = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(3),
  marginBottom: theme.spacing(2),
  flexWrap: 'wrap',
}));

const AppFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  const handleLinkClick = (url: string) => {
    // In Electron, open external links in default browser
    if (window.electronAPI) {
      window.open(url, '_blank');
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <FooterContainer>
      <FooterLinks>
        <Link
          component="button"
          variant="body2"
          onClick={() => handleLinkClick('https://anava.com')}
          sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          About Anava
        </Link>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>•</Typography>
        <Link
          component="button"
          variant="body2"
          onClick={() => handleLinkClick('https://anava.com/privacy')}
          sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          Privacy Policy
        </Link>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>•</Typography>
        <Link
          component="button"
          variant="body2"
          onClick={() => handleLinkClick('https://anava.com/terms')}
          sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          Terms of Service
        </Link>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>•</Typography>
        <Link
          component="button"
          variant="body2"
          onClick={() => handleLinkClick('https://docs.anava.com')}
          sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          Documentation
        </Link>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>•</Typography>
        <Link
          component="button"
          variant="body2"
          onClick={() => handleLinkClick('https://support.anava.com')}
          sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          Support
        </Link>
      </FooterLinks>
      
      <Divider sx={{ mb: 2 }} />
      
      <Typography variant="caption" display="block" gutterBottom>
        © {currentYear} Anava Inc. All rights reserved.
      </Typography>
      
      <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mt: 1, opacity: 0.7 }}>
        Anava Vision
      </Typography>
      
      <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem', mt: 0.5, opacity: 0.5 }}>
        This software is provided "as is" without warranty of any kind. Use of this tool requires
        appropriate Google Cloud Platform permissions and may incur costs.
      </Typography>
    </FooterContainer>
  );
};

export default AppFooter;