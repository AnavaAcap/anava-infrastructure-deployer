import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavigationGuardOptions {
  when: boolean;
  message?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export const useNavigationGuard = ({
  when,
  message = 'You have unsaved changes. Are you sure you want to leave?',
  onConfirm,
  onCancel
}: NavigationGuardOptions) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isLockedRef = useRef(false); // Prevent multiple dialogs
  const isMountedRef = useRef(true);

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle browser back/forward buttons and tab close
  useEffect(() => {
    if (!when) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [when, message]);

  const confirmNavigation = useCallback(async () => {
    if (!pendingNavigation || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      // Await the cleanup operation
      if (onConfirm) {
        await onConfirm();
      }
      
      // Only proceed if still mounted and navigation wasn't cancelled
      if (isMountedRef.current && pendingNavigation) {
        const path = pendingNavigation;
        setShowDialog(false);
        setPendingNavigation(null);
        isLockedRef.current = false;
        navigate(path);
      }
    } catch (error) {
      console.error('Failed to complete cleanup before navigation:', error);
      // Show error to user - navigation cancelled
      if (isMountedRef.current) {
        alert('Could not complete the operation cleanup. Please try again or save your work manually.');
        setShowDialog(false);
        setPendingNavigation(null);
        isLockedRef.current = false;
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [pendingNavigation, navigate, onConfirm, isProcessing]);

  const cancelNavigation = useCallback(() => {
    if (isProcessing) return; // Don't allow cancel during processing
    
    setShowDialog(false);
    setPendingNavigation(null);
    isLockedRef.current = false;
    onCancel?.();
  }, [onCancel, isProcessing]);

  const guardedNavigate = useCallback((path: string) => {
    // Prevent multiple dialogs
    if (isLockedRef.current || isProcessing) {
      console.warn('Navigation already in progress, ignoring new request');
      return;
    }
    
    if (when) {
      isLockedRef.current = true;
      setPendingNavigation(path);
      setShowDialog(true);
    } else {
      navigate(path);
    }
  }, [when, navigate, isProcessing]);

  return {
    showDialog,
    confirmNavigation,
    cancelNavigation,
    guardedNavigate,
    message,
    isProcessing // Expose this so dialog can show loading state
  };
};