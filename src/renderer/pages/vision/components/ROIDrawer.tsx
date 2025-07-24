import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Timeline as LineIcon,
  CropFree as PolygonIcon,
  Clear as ClearIcon,
  Undo as UndoIcon,
  Done as DoneIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import { 
  RegionOfInterest, 
  ROIType, 
  Point,
  AgentTemplate,
} from '../../../../types/visionAgent';

interface ROIDrawerProps {
  cameraId: string;
  template?: AgentTemplate;
  existingROIs?: RegionOfInterest[];
  onComplete: (rois: RegionOfInterest[]) => void;
}

const ROIDrawer: React.FC<ROIDrawerProps> = ({ 
  cameraId, 
  template, 
  existingROIs = [], 
  onComplete 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawMode, setDrawMode] = useState<ROIType>(ROIType.POLYGON);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [regions, setRegions] = useState<RegionOfInterest[]>(existingROIs);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Load camera snapshot as background
    loadCameraSnapshot();
  }, [cameraId]);

  useEffect(() => {
    // Redraw canvas when regions change
    drawCanvas();
  }, [regions, currentPoints, zoom, pan]);

  const loadCameraSnapshot = async () => {
    try {
      // TODO: Load actual camera snapshot
      // For now, use placeholder
      const img = new Image();
      img.src = `/api/placeholder/camera/${cameraId}/snapshot.jpg`;
      img.onload = () => {
        setBackgroundImage(img.src);
        if (canvasRef.current && containerRef.current) {
          canvasRef.current.width = containerRef.current.clientWidth;
          canvasRef.current.height = (containerRef.current.clientWidth * 9) / 16; // 16:9 aspect
          drawCanvas();
        }
      };
    } catch (error) {
      console.error('Failed to load camera snapshot:', error);
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image if available
    if (backgroundImage) {
      const img = new Image();
      img.src = backgroundImage;
      img.onload = () => {
        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);
        ctx.drawImage(img, 0, 0, canvas.width / zoom, canvas.height / zoom);
        ctx.restore();

        // Draw existing regions
        drawRegions(ctx);

        // Draw current drawing
        if (currentPoints.length > 0) {
          drawCurrentShape(ctx);
        }
      };
    }
  };

  const drawRegions = (ctx: CanvasRenderingContext2D) => {
    regions.forEach((region, index) => {
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Set style
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2 / zoom;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';

      if (region.type === ROIType.POLYGON) {
        ctx.beginPath();
        region.points.forEach((point, i) => {
          const x = (point.x / 100) * canvasRef.current!.width / zoom;
          const y = (point.y / 100) * canvasRef.current!.height / zoom;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (region.type === ROIType.LINE) {
        ctx.beginPath();
        const x1 = (region.points[0].x / 100) * canvasRef.current!.width / zoom;
        const y1 = (region.points[0].y / 100) * canvasRef.current!.height / zoom;
        const x2 = (region.points[1].x / 100) * canvasRef.current!.width / zoom;
        const y2 = (region.points[1].y / 100) * canvasRef.current!.height / zoom;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw arrow to indicate direction
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.save();
        ctx.translate(x2, y2);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-10, -5);
        ctx.lineTo(-10, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw label
      ctx.fillStyle = '#00ff00';
      ctx.font = `${14 / zoom}px Arial`;
      const labelX = (region.points[0].x / 100) * canvasRef.current!.width / zoom;
      const labelY = (region.points[0].y / 100) * canvasRef.current!.height / zoom - 10;
      ctx.fillText(region.name || `Region ${index + 1}`, labelX, labelY);

      ctx.restore();
    });
  };

  const drawCurrentShape = (ctx: CanvasRenderingContext2D) => {
    if (currentPoints.length === 0) return;

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([5 / zoom, 5 / zoom]);

    ctx.beginPath();
    currentPoints.forEach((point, i) => {
      const x = (point.x / 100) * canvasRef.current!.width / zoom;
      const y = (point.y / 100) * canvasRef.current!.height / zoom;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    if (drawMode === ROIType.POLYGON && currentPoints.length > 2) {
      ctx.closePath();
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left - pan.x) / zoom / canvas.width) * 100;
    const y = ((e.clientY - rect.top - pan.y) / zoom / canvas.height) * 100;

    const newPoint: Point = { x, y };

    if (drawMode === ROIType.LINE) {
      if (currentPoints.length === 0) {
        setCurrentPoints([newPoint]);
        setIsDrawing(true);
      } else {
        // Complete the line
        const newRegion: RegionOfInterest = {
          id: `roi-${Date.now()}`,
          name: `Line ${regions.length + 1}`,
          type: ROIType.LINE,
          points: [currentPoints[0], newPoint],
          cameraId,
        };
        setRegions([...regions, newRegion]);
        setCurrentPoints([]);
        setIsDrawing(false);
      }
    } else if (drawMode === ROIType.POLYGON) {
      if (!isDrawing) {
        setCurrentPoints([newPoint]);
        setIsDrawing(true);
      } else {
        setCurrentPoints([...currentPoints, newPoint]);
      }
    }
  };

  const completePolygon = () => {
    if (currentPoints.length < 3) {
      alert('A polygon needs at least 3 points');
      return;
    }

    const newRegion: RegionOfInterest = {
      id: `roi-${Date.now()}`,
      name: `Zone ${regions.length + 1}`,
      type: ROIType.POLYGON,
      points: currentPoints,
      cameraId,
    };

    setRegions([...regions, newRegion]);
    setCurrentPoints([]);
    setIsDrawing(false);
  };

  const clearAll = () => {
    setRegions([]);
    setCurrentPoints([]);
    setIsDrawing(false);
  };

  const undo = () => {
    if (currentPoints.length > 0) {
      setCurrentPoints(currentPoints.slice(0, -1));
    } else if (regions.length > 0) {
      setRegions(regions.slice(0, -1));
    }
  };

  const handleComplete = () => {
    if (regions.length === 0) {
      alert('Please draw at least one region');
      return;
    }
    onComplete(regions);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom align="center">
        Define the area for your agent
      </Typography>
      
      {template?.requiredInputs.find(i => i.type === 'roi') && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {template.requiredInputs.find(i => i.type === 'roi')?.label}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={drawMode}
            exclusive
            onChange={(_, mode) => mode && setDrawMode(mode)}
            size="small"
          >
            <ToggleButton value={ROIType.POLYGON}>
              <PolygonIcon sx={{ mr: 1 }} />
              Zone
            </ToggleButton>
            <ToggleButton value={ROIType.LINE}>
              <LineIcon sx={{ mr: 1 }} />
              Line
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ flex: 1 }} />

          <Tooltip title="Zoom In">
            <IconButton onClick={() => setZoom(z => Math.min(z * 1.2, 3))}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Zoom Out">
            <IconButton onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Undo">
            <IconButton onClick={undo} disabled={currentPoints.length === 0 && regions.length === 0}>
              <UndoIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Clear All">
            <IconButton onClick={clearAll} disabled={regions.length === 0}>
              <ClearIcon />
            </IconButton>
          </Tooltip>

          {isDrawing && drawMode === ROIType.POLYGON && currentPoints.length > 2 && (
            <Button
              variant="contained"
              size="small"
              startIcon={<DoneIcon />}
              onClick={completePolygon}
            >
              Complete Polygon
            </Button>
          )}
        </Box>
      </Paper>

      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: '100%',
          maxHeight: 500,
          overflow: 'hidden',
          border: '2px solid',
          borderColor: 'divider',
          borderRadius: 1,
          cursor: isDrawing ? 'crosshair' : 'default',
        }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
      </Box>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          {regions.length} region{regions.length !== 1 ? 's' : ''} defined
        </Typography>
        
        <Button
          variant="contained"
          color="primary"
          onClick={handleComplete}
          disabled={regions.length === 0}
        >
          Continue
        </Button>
      </Box>
    </Box>
  );
};

export default ROIDrawer;