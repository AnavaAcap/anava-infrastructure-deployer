import React, { useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Grid,
  TextField,
  Button,
  Paper,
  Chip,
  IconButton,
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { AgentTemplate, ScheduleRule } from '../../../../types/visionAgent';

interface ScheduleBuilderProps {
  template?: AgentTemplate;
  onComplete: (schedule: any) => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ScheduleBuilder: React.FC<ScheduleBuilderProps> = ({ template, onComplete }) => {
  const [scheduleType, setScheduleType] = useState<'always' | 'custom'>('always');
  const [customRules, setCustomRules] = useState<ScheduleRule[]>([{
    days: [1, 2, 3, 4, 5], // Weekdays by default
    startTime: '18:00',
    endTime: '06:00',
    active: true,
  }]);

  const handleScheduleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setScheduleType(event.target.value as 'always' | 'custom');
  };

  const handleDayToggle = (ruleIndex: number, dayIndex: number) => {
    const newRules = [...customRules];
    const rule = newRules[ruleIndex];
    
    if (rule.days.includes(dayIndex)) {
      rule.days = rule.days.filter(d => d !== dayIndex);
    } else {
      rule.days = [...rule.days, dayIndex].sort();
    }
    
    setCustomRules(newRules);
  };

  const handleTimeChange = (ruleIndex: number, field: 'startTime' | 'endTime', value: string) => {
    const newRules = [...customRules];
    newRules[ruleIndex][field] = value;
    setCustomRules(newRules);
  };

  const addRule = () => {
    setCustomRules([...customRules, {
      days: [],
      startTime: '00:00',
      endTime: '23:59',
      active: true,
    }]);
  };

  const removeRule = (index: number) => {
    setCustomRules(customRules.filter((_, i) => i !== index));
  };

  const handleComplete = () => {
    if (scheduleType === 'always') {
      onComplete(null); // No schedule means always active
    } else {
      // Validate rules
      const validRules = customRules.filter(rule => rule.days.length > 0);
      if (validRules.length === 0) {
        alert('Please configure at least one schedule rule');
        return;
      }
      
      onComplete({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        rules: validRules,
      });
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom align="center">
        When should your agent be active?
      </Typography>

      <FormControl component="fieldset" sx={{ mt: 3 }}>
        <FormLabel component="legend">Schedule Type</FormLabel>
        <RadioGroup value={scheduleType} onChange={handleScheduleTypeChange}>
          <FormControlLabel
            value="always"
            control={<Radio />}
            label="Always Active (24/7)"
          />
          <FormControlLabel
            value="custom"
            control={<Radio />}
            label="Custom Schedule"
          />
        </RadioGroup>
      </FormControl>

      {scheduleType === 'custom' && (
        <Box sx={{ mt: 4 }}>
          {customRules.map((rule, ruleIndex) => (
            <Paper key={ruleIndex} sx={{ p: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1">
                  Schedule Rule {ruleIndex + 1}
                </Typography>
                {customRules.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => removeRule(ruleIndex)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  Active Days:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {DAYS.map((day, dayIndex) => (
                    <Chip
                      key={dayIndex}
                      label={day.substring(0, 3)}
                      onClick={() => handleDayToggle(ruleIndex, dayIndex)}
                      color={rule.days.includes(dayIndex) ? 'primary' : 'default'}
                      variant={rule.days.includes(dayIndex) ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Start Time"
                    type="time"
                    value={rule.startTime}
                    onChange={(e) => handleTimeChange(ruleIndex, 'startTime', e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 300 }} // 5 min intervals
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="End Time"
                    type="time"
                    value={rule.endTime}
                    onChange={(e) => handleTimeChange(ruleIndex, 'endTime', e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 300 }}
                  />
                </Grid>
              </Grid>

              {rule.startTime > rule.endTime && (
                <Typography variant="caption" color="info.main" sx={{ mt: 1, display: 'block' }}>
                  <TimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                  Schedule spans midnight (overnight hours)
                </Typography>
              )}
            </Paper>
          ))}

          <Button
            startIcon={<AddIcon />}
            onClick={addRule}
            variant="outlined"
            fullWidth
          >
            Add Another Schedule Rule
          </Button>
        </Box>
      )}

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleComplete}
        >
          Continue
        </Button>
      </Box>
    </Box>
  );
};

export default ScheduleBuilder;