import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';
import VisionConnectionPage from './VisionConnectionPage';
import VisionAgentPage from './VisionAgentPage';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vision-tabpanel-${index}`}
      aria-labelledby={`vision-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface VisionPageProps {
  deploymentConfig?: any;
  configuredCameras?: any[];
}

const VisionPage: React.FC<VisionPageProps> = ({ deploymentConfig, configuredCameras = [] }) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Vision System
        </Typography>
        <Typography variant="body1" color="text.secondary">
          AI-powered camera intelligence with MCP and autonomous agents
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="vision tabs">
          <Tab 
            icon={<VideocamIcon />} 
            label="MCP Connection" 
            iconPosition="start"
          />
          <Tab 
            icon={<SmartToyIcon />} 
            label="Vision Agents" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <TabPanel value={activeTab} index={0}>
          <VisionConnectionPage 
            deploymentConfig={deploymentConfig} 
            configuredCameras={configuredCameras} 
          />
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          <VisionAgentPage 
            deploymentConfig={deploymentConfig} 
            configuredCameras={configuredCameras} 
          />
        </TabPanel>
      </Box>
    </Box>
  );
};

export default VisionPage;