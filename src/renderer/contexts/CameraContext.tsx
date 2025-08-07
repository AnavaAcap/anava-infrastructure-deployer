import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Camera configuration status for each step
export interface CameraStepStatus {
  credentials: {
    completed: boolean;
    username?: string;
    password?: string;
  };
  discovery: {
    completed: boolean;
    ip?: string;
    model?: string;
    firmwareVersion?: string;
    accessible?: boolean;
  };
  deployment: {
    completed: boolean;
    hasACAP?: boolean;
    isLicensed?: boolean;
    acapVersion?: string;
    deployedFile?: string;
    licenseKey?: string;
  };
  speaker: {
    completed: boolean;
    configured?: boolean;
    ip?: string;
    username?: string;
    password?: string;
  };
  verification: {
    completed: boolean;
    sceneAnalysis?: {
      description: string;
      imageBase64: string;
      audioBase64?: string;
    };
  };
}

export interface ManagedCamera {
  id: string; // Unique identifier (e.g., ip_model)
  name: string;
  ip: string;
  model?: string;
  status: CameraStepStatus;
  lastUpdated: Date;
  // Additional metadata
  projectId?: string; // Associated GCP project if any
  customerId?: string;
  anavaKey?: string;
}

interface CameraContextType {
  // All managed cameras
  cameras: ManagedCamera[];
  
  // Currently selected camera for editing
  selectedCamera: ManagedCamera | null;
  
  // Actions
  addCamera: (camera: Partial<ManagedCamera>) => void;
  updateCamera: (id: string, updates: Partial<ManagedCamera>) => void;
  updateCameraStep: (id: string, step: keyof CameraStepStatus, data: any) => void;
  selectCamera: (id: string | null) => void;
  removeCamera: (id: string) => void;
  getCameraById: (id: string) => ManagedCamera | undefined;
  
  // Persistence
  loadCameras: () => Promise<void>;
  saveCameras: () => Promise<void>;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const useCameraContext = () => {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error('useCameraContext must be used within a CameraProvider');
  }
  return context;
};

interface CameraProviderProps {
  children: ReactNode;
}

export const CameraProvider: React.FC<CameraProviderProps> = ({ children }) => {
  const [cameras, setCameras] = useState<ManagedCamera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<ManagedCamera | null>(null);

  // Load cameras from persistent storage on mount
  useEffect(() => {
    loadCameras();
  }, []);

  // Save cameras whenever they change
  useEffect(() => {
    if (cameras.length > 0) {
      saveCameras();
    }
  }, [cameras]);

  const loadCameras = async () => {
    try {
      const savedCameras = await (window.electronAPI as any).getConfigValue?.('managedCameras') || [];
      
      // Convert saved data to ManagedCamera format
      const loadedCameras: ManagedCamera[] = savedCameras.map((cam: any) => ({
        ...cam,
        lastUpdated: new Date(cam.lastUpdated || Date.now())
      }));
      
      setCameras(loadedCameras);
      console.log('Loaded managed cameras:', loadedCameras);
    } catch (error) {
      console.error('Failed to load managed cameras:', error);
    }
  };

  const saveCameras = async () => {
    try {
      await (window.electronAPI as any).setConfigValue?.('managedCameras', cameras);
      console.log('Saved managed cameras');
    } catch (error) {
      console.error('Failed to save managed cameras:', error);
    }
  };

  const addCamera = (cameraData: Partial<ManagedCamera>) => {
    const newCamera: ManagedCamera = {
      id: cameraData.id || `${cameraData.ip}_${Date.now()}`,
      name: cameraData.name || cameraData.model || `Camera at ${cameraData.ip}`,
      ip: cameraData.ip || '',
      model: cameraData.model,
      status: cameraData.status || {
        credentials: { completed: false },
        discovery: { completed: false },
        deployment: { completed: false },
        speaker: { completed: false },
        verification: { completed: false }
      },
      lastUpdated: new Date(),
      ...cameraData
    };

    setCameras(prev => {
      // Check if camera already exists
      const existing = prev.find(c => c.ip === newCamera.ip);
      if (existing) {
        // Update existing camera
        return prev.map(c => c.ip === newCamera.ip ? { ...c, ...newCamera, id: c.id } : c);
      }
      return [...prev, newCamera];
    });
  };

  const updateCamera = (id: string, updates: Partial<ManagedCamera>) => {
    setCameras(prev => prev.map(camera => 
      camera.id === id 
        ? { ...camera, ...updates, lastUpdated: new Date() }
        : camera
    ));
    
    // Update selected camera if it's the one being updated
    if (selectedCamera?.id === id) {
      setSelectedCamera(prev => prev ? { ...prev, ...updates, lastUpdated: new Date() } : null);
    }
  };

  const updateCameraStep = (id: string, step: keyof CameraStepStatus, data: any) => {
    setCameras(prev => prev.map(camera => {
      if (camera.id === id) {
        return {
          ...camera,
          status: {
            ...camera.status,
            [step]: {
              ...camera.status[step],
              ...data,
              completed: data.completed !== undefined ? data.completed : true
            }
          },
          lastUpdated: new Date()
        };
      }
      return camera;
    }));
    
    // Update selected camera if it's the one being updated
    if (selectedCamera?.id === id) {
      setSelectedCamera(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: {
            ...prev.status,
            [step]: {
              ...prev.status[step],
              ...data,
              completed: data.completed !== undefined ? data.completed : true
            }
          },
          lastUpdated: new Date()
        };
      });
    }
  };

  const selectCamera = (id: string | null) => {
    if (id === null) {
      setSelectedCamera(null);
    } else {
      const camera = cameras.find(c => c.id === id);
      setSelectedCamera(camera || null);
    }
  };

  const removeCamera = (id: string) => {
    setCameras(prev => prev.filter(camera => camera.id !== id));
    if (selectedCamera?.id === id) {
      setSelectedCamera(null);
    }
  };

  const getCameraById = (id: string) => {
    return cameras.find(c => c.id === id);
  };

  const value: CameraContextType = {
    cameras,
    selectedCamera,
    addCamera,
    updateCamera,
    updateCameraStep,
    selectCamera,
    removeCamera,
    getCameraById,
    loadCameras,
    saveCameras
  };

  return (
    <CameraContext.Provider value={value}>
      {children}
    </CameraContext.Provider>
  );
};

export default CameraContext;