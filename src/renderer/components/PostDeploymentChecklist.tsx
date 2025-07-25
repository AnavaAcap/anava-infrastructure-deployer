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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  Checkbox,
  Stack,
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
  CloudUpload,
  Warning,
  Add,
  CheckCircle,
} from '@mui/icons-material';

interface PostDeploymentChecklistProps {
  projectId: string;
  firebaseConfig?: any;
  onComplete: () => void;
  onFirebaseSetupComplete?: (isComplete: boolean) => void;
  authConfigured?: boolean;
}

const PostDeploymentChecklist: React.FC<PostDeploymentChecklistProps> = ({
  projectId,
  firebaseConfig,
  onComplete,
  onFirebaseSetupComplete,
  authConfigured = true,
}) => {
  const [checkedItems, setCheckedItems] = React.useState<string[]>([]);
  const [createUserOpen, setCreateUserOpen] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState('');
  const [userPassword, setUserPassword] = React.useState('');
  const [creatingUser, setCreatingUser] = React.useState(false);
  const [userCreated, setUserCreated] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Track Firebase setup completion
  React.useEffect(() => {
    let allComplete = false;
    
    if (authConfigured) {
      // Auth is automated, only need user creation
      allComplete = userCreated;
    } else {
      // Auth needs manual setup, need both auth checkbox and user creation
      allComplete = checkedItems.includes('enable-auth') && userCreated;
    }
    
    if (onFirebaseSetupComplete) {
      onFirebaseSetupComplete(allComplete);
    }
  }, [authConfigured, checkedItems, userCreated, onFirebaseSetupComplete]);

  const handleToggle = (item: string) => {
    setCheckedItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  const handleCreateUser = async () => {
    if (!userEmail || !userPassword || !firebaseConfig?.apiKey) {
      setError('Missing required information');
      return;
    }

    setCreatingUser(true);
    setError(null);

    try {
      const result = await window.electronAPI.createFirebaseUser({
        projectId,
        email: userEmail,
        password: userPassword,
        apiKey: firebaseConfig.apiKey
      });

      if (result.success) {
        setUserCreated(true);
        setCheckedItems(prev => [...prev, 'create-user']);
        setCreateUserOpen(false);
        setUserEmail('');
        setUserPassword('');
      } else {
        setError(result.error || 'Failed to create user');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;
  const firebaseStorageUrl = `https://console.firebase.google.com/project/${projectId}/storage`;
  const firebaseUsersUrl = `https://console.firebase.google.com/project/${projectId}/authentication/users`;

  const authItem = authConfigured ? {
    id: 'auth-enabled',
    icon: <Security />,
    primary: 'Firebase Authentication Enabled',
    secondary: '✅ Email/Password authentication is now active',
    required: false,
    completed: true,
    action: (
      <Chip 
        icon={<CheckCircle />} 
        label="Automated" 
        color="success" 
        variant="outlined"
        size="small"
      />
    ),
  } : {
    id: 'enable-auth',
    icon: <Security />,
    primary: 'Enable Email/Password Authentication',
    secondary: 'Enable Email/Password in Authentication > Sign-in method',
    required: true,
    completed: false,
    action: (
      <Button
        size="small"
        variant="outlined"
        endIcon={<OpenInNew />}
        onClick={() => window.electronAPI.openExternal(firebaseConsoleUrl)}
      >
        Open Auth Console
      </Button>
    ),
  };

  const checklistItems = [
    authItem,
    {
      id: 'storage-enabled',
      icon: <CloudUpload />,
      primary: 'Firebase Storage Initialized',
      secondary: '✅ Storage bucket created and configured with CORS',
      required: false,
      completed: true,
      action: (
        <Chip 
          icon={<CheckCircle />} 
          label="Automated" 
          color="success" 
          variant="outlined"
          size="small"
        />
      ),
    },
    {
      id: 'create-user',
      icon: <Person />,
      primary: 'Create First Admin User',
      secondary: userCreated ? '✅ Admin user created successfully!' : 'Add an admin user for camera authentication',
      required: true,
      completed: userCreated,
      action: (
        <Button
          size="small"
          variant={userCreated ? "outlined" : "contained"}
          color={userCreated ? "success" : "primary"}
          endIcon={userCreated ? <CheckCircle /> : <Add />}
          onClick={() => setCreateUserOpen(true)}
          disabled={userCreated || (!authConfigured && !checkedItems.includes('enable-auth'))}
        >
          {userCreated ? 'User Created' : 'Create User'}
        </Button>
      ),
    },
  ];

  const requiredItems = checklistItems.filter(item => item.required);
  const allRequiredChecked = requiredItems.every(item => 
    item.completed || checkedItems.includes(item.id) || (item.id === 'create-user' && userCreated)
  );

  return (
    <>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          🚀 Infrastructure Deployed Successfully!
        </Typography>
        
        <Alert severity={authConfigured ? "success" : "warning"} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            {authConfigured ? "Firebase Setup Complete!" : "Firebase Setup Partially Complete"}
          </Typography>
          <Typography variant="body2">
            {authConfigured 
              ? "Firebase Authentication and Storage have been automatically configured. Only one final step remains - create your admin user below."
              : "Firebase Storage has been configured automatically, but Authentication needs manual setup. Complete the steps below to finish the configuration."
            }
          </Typography>
        </Alert>

        <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
          Setup Status
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Firebase services are automatically configured. Create an admin user to complete the setup.
        </Typography>

        <List>
          {checklistItems.map((item, index) => (
            <React.Fragment key={item.id}>
              <ListItem
                sx={{
                  bgcolor: item.completed || checkedItems.includes(item.id) || (item.id === 'create-user' && userCreated) 
                    ? 'action.hover' 
                    : 'transparent',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={item.completed || checkedItems.includes(item.id) || (item.id === 'create-user' && userCreated)}
                    onChange={() => handleToggle(item.id)}
                    disabled={item.completed || (item.id === 'create-user' && userCreated)}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle1">{item.primary}</Typography>
                      {item.required && (
                        <Chip label="Required" size="small" color="error" />
                      )}
                    </Stack>
                  }
                  secondary={item.secondary}
                />
                {item.action}
              </ListItem>
              {index < checklistItems.length - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))}
        </List>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={onComplete}
            disabled={!allRequiredChecked}
            startIcon={allRequiredChecked ? <CheckCircleOutline /> : <Warning />}
          >
            {allRequiredChecked ? 'Continue to Export' : 'Complete All Steps First'}
          </Button>
          {!allRequiredChecked && (
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
              You must complete all required steps before exporting the configuration
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Create User Dialog */}
      <Dialog 
        open={createUserOpen} 
        onClose={() => !creatingUser && setCreateUserOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Admin User</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create an admin user that will be used for camera authentication. Make sure you've already enabled Email/Password authentication in Firebase.
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            variant="outlined"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={userPassword}
            onChange={(e) => setUserPassword(e.target.value)}
            helperText="Use a strong password (min 6 characters)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateUserOpen(false)} disabled={creatingUser}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateUser} 
            variant="contained"
            disabled={creatingUser || !userEmail || !userPassword || userPassword.length < 6}
          >
            {creatingUser ? <CircularProgress size={20} /> : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PostDeploymentChecklist;