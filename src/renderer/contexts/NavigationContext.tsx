import React, { createContext, useContext, useState, useCallback } from 'react';

interface NavigationContextType {
  activeOperation: string | null;
  setActiveOperation: (operation: string | null) => void;
  canNavigate: () => boolean;
  getNavigationWarning: () => string | null;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeOperation, setActiveOperation] = useState<string | null>(null);

  const canNavigate = useCallback(() => {
    return activeOperation === null;
  }, [activeOperation]);

  const getNavigationWarning = useCallback(() => {
    if (!activeOperation) return null;
    
    switch (activeOperation) {
      case 'cloud-deployment':
        return 'Cloud deployment is in progress. Leaving will cancel the deployment.';
      case 'acap-deployment':
        return 'ACAP deployment is in progress. Leaving may require factory reset.';
      case 'camera-scan':
        return 'Camera scan is in progress. Leaving will stop the scan.';
      case 'speaker-config':
        return 'Speaker configuration is in progress. Leaving will cancel the setup.';
      default:
        return 'An operation is in progress. Leaving may lose your progress.';
    }
  }, [activeOperation]);

  return (
    <NavigationContext.Provider
      value={{
        activeOperation,
        setActiveOperation,
        canNavigate,
        getNavigationWarning,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};