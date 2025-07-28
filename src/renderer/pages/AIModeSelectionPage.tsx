import React from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Card,
  CardContent,
  CardActions,
  Stack,
  Chip,
} from '@mui/material';
import {
  Cloud,
  Key,
  ArrowForward,
} from '@mui/icons-material';
import TopBar from '../components/TopBar';

interface AIModeSelectionPageProps {
  onSelectMode: (mode: 'vertex' | 'ai-studio') => void;
  onLogout?: () => void;
}

const AIModeSelectionPage: React.FC<AIModeSelectionPageProps> = ({ onSelectMode, onLogout }) => {
  return (
    <Paper elevation={3} sx={{ p: 6 }}>
      <TopBar 
        title="Choose AI Integration Mode" 
        showLogout={!!onLogout}
        onLogout={onLogout}
      />
      
      <Typography variant="h5" gutterBottom sx={{ mb: 4, textAlign: 'center' }}>
        How would you like to integrate AI capabilities?
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mt: 4 }}>
        {/* Vertex AI Card */}
        <Card sx={{ flex: 1, position: 'relative' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Cloud fontSize="large" color="primary" />
              <Typography variant="h6">
                Vertex AI
              </Typography>
              <Chip label="Recommended" color="primary" size="small" />
            </Stack>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              Full production infrastructure with API Gateway, Cloud Functions, and complete security.
            </Typography>
            
            <Typography variant="subtitle2" gutterBottom>
              Perfect for:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <Typography component="li" variant="body2">Production deployments</Typography>
              <Typography component="li" variant="body2">Multiple cameras at scale</Typography>
              <Typography component="li" variant="body2">Enterprise security requirements</Typography>
              <Typography component="li" variant="body2">Complete GCP integration</Typography>
            </Box>
            
            <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
              What's included:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <Typography component="li" variant="body2">API Gateway for secure access</Typography>
              <Typography component="li" variant="body2">Cloud Functions for authentication</Typography>
              <Typography component="li" variant="body2">Workload Identity Federation</Typography>
              <Typography component="li" variant="body2">Firebase & Firestore integration</Typography>
            </Box>
            
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 2 }}>
              Requires GCP project • ~20 min deployment
            </Typography>
          </CardContent>
          <CardActions>
            <Button 
              variant="contained" 
              fullWidth 
              endIcon={<ArrowForward />}
              onClick={() => onSelectMode('vertex')}
            >
              Use Vertex AI
            </Button>
          </CardActions>
        </Card>

        {/* AI Studio Card */}
        <Card sx={{ flex: 1, position: 'relative' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Key fontSize="large" color="secondary" />
              <Typography variant="h6">
                Google AI Studio
              </Typography>
              <Chip label="Simple" color="secondary" size="small" variant="outlined" />
            </Stack>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              Direct API access to Gemini models with just an API key. No infrastructure needed.
            </Typography>
            
            <Typography variant="subtitle2" gutterBottom>
              Perfect for:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <Typography component="li" variant="body2">Quick prototypes</Typography>
              <Typography component="li" variant="body2">Development and testing</Typography>
              <Typography component="li" variant="body2">Single camera setups</Typography>
              <Typography component="li" variant="body2">Minimal configuration</Typography>
            </Box>
            
            <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
              What's included:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <Typography component="li" variant="body2">Direct Gemini API access</Typography>
              <Typography component="li" variant="body2">Simple API key authentication</Typography>
              <Typography component="li" variant="body2">No infrastructure to manage</Typography>
              <Typography component="li" variant="body2">Immediate access</Typography>
            </Box>
            
            <Typography variant="caption" color="info.main" sx={{ display: 'block', mt: 2 }}>
              Project optional • ~2 min setup
            </Typography>
          </CardContent>
          <CardActions>
            <Button 
              variant="outlined" 
              fullWidth 
              endIcon={<ArrowForward />}
              onClick={() => onSelectMode('ai-studio')}
            >
              Use AI Studio
            </Button>
          </CardActions>
        </Card>
      </Stack>

      <Box sx={{ mt: 4, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Not sure which to choose? Start with AI Studio for quick testing, then upgrade to Vertex AI for production.
        </Typography>
      </Box>
    </Paper>
  );
};

export default AIModeSelectionPage;