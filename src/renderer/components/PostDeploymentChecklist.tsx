import React from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Link,
  Divider,
  Alert,
  Chip,
} from '@mui/material';
import {
  CheckCircleOutline,
  RadioButtonUnchecked,
  OpenInNew,
  ContentCopy,
  Email,
  VpnKey,
  Security,
  Person,
} from '@mui/icons-material';

interface PostDeploymentChecklistProps {
  projectId: string;
  firebaseConfig?: any;
  onComplete: () => void;
}

const PostDeploymentChecklist: React.FC<PostDeploymentChecklistProps> = ({
  projectId,
  firebaseConfig,
  onComplete,
}) => {
  const [checkedItems, setCheckedItems] = React.useState<string[]>([]);

  const handleToggle = (item: string) => {
    setCheckedItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;
  const firebaseUsersUrl = `https://console.firebase.google.com/project/${projectId}/authentication/users`;

  const checklistItems = [
    {
      id: 'enable-auth',
      icon: <Security />,
      primary: 'Enable Email/Password Authentication',
      secondary: 'Go to Firebase Console > Authentication > Sign-in method',
      action: (
        <Button
          size="small"
          variant="outlined"
          endIcon={<OpenInNew />}
          href={firebaseConsoleUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Firebase Console
        </Button>
      ),
    },
    {
      id: 'create-user',
      icon: <Person />,
      primary: 'Create First Admin User',
      secondary: 'Add an email/password user in Firebase Console',
      action: (
        <Button
          size="small"
          variant="outlined"
          endIcon={<OpenInNew />}
          href={firebaseUsersUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Add User
        </Button>
      ),
    },
    {
      id: 'verify-config',
      icon: <VpnKey />,
      primary: 'Save Firebase Configuration',
      secondary: 'Copy and save the Firebase config for your application',
      action: firebaseConfig && (
        <Button
          size="small"
          variant="outlined"
          endIcon={<ContentCopy />}
          onClick={() => navigator.clipboard.writeText(JSON.stringify(firebaseConfig, null, 2))}
        >
          Copy Config
        </Button>
      ),
    },
  ];

  const allChecked = checklistItems.every(item => checkedItems.includes(item.id));

  return (
    <Paper elevation={3} sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        🎉 Deployment Complete!
      </Typography>
      
      <Alert severity="success" sx={{ mb: 3 }}>
        Your Anava authentication infrastructure has been successfully deployed to Google Cloud Platform.
      </Alert>

      <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Final Setup Steps
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Complete these steps in the Firebase Console to finish setting up authentication:
      </Typography>

      <List>
        {checklistItems.map((item, index) => (
          <React.Fragment key={item.id}>
            <ListItem
              sx={{
                bgcolor: checkedItems.includes(item.id) ? 'action.hover' : 'transparent',
                borderRadius: 1,
                mb: 1,
                cursor: 'pointer',
              }}
              onClick={() => handleToggle(item.id)}
            >
              <ListItemIcon>
                {checkedItems.includes(item.id) ? (
                  <CheckCircleOutline color="success" />
                ) : (
                  <RadioButtonUnchecked />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {item.icon}
                    <Typography variant="subtitle1">{item.primary}</Typography>
                    {index === 0 && <Chip label="Required" size="small" color="error" />}
                  </Box>
                }
                secondary={item.secondary}
              />
              <Box sx={{ ml: 2 }}>
                {item.action}
              </Box>
            </ListItem>
            {index < checklistItems.length - 1 && <Divider sx={{ my: 1 }} />}
          </React.Fragment>
        ))}
      </List>

      {firebaseConfig && (
        <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Firebase Configuration:
          </Typography>
          <Typography
            variant="body2"
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              overflow: 'auto',
              maxHeight: 200,
            }}
          >
            {JSON.stringify(firebaseConfig, null, 2)}
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          size="large"
          onClick={onComplete}
          disabled={!allChecked}
        >
          {allChecked ? 'Complete Setup' : `Complete ${checkedItems.length}/${checklistItems.length} Steps`}
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block', textAlign: 'center' }}>
        Need help? Check out the{' '}
        <Link
          href="https://firebase.google.com/docs/auth/web/password-auth"
          target="_blank"
          rel="noopener noreferrer"
        >
          Firebase Authentication documentation
        </Link>
      </Typography>
    </Paper>
  );
};

export default PostDeploymentChecklist;