import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ToastNotification, InlineNotification } from '@carbon/react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  subtitle?: string;
  timeout?: number;
  onClose?: () => void;
  hideCloseButton?: boolean;
  lowContrast?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  showSuccess: (title: string, subtitle?: string) => string;
  showError: (title: string, subtitle?: string) => string;
  showWarning: (title: string, subtitle?: string) => string;
  showInfo: (title: string, subtitle?: string) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = () => {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addNotification = (notification: Omit<Notification, 'id'>): string => {
    const id = generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      timeout: notification.timeout ?? 5000, // Default 5 seconds
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove notification after timeout
    if (newNotification.timeout && newNotification.timeout > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.timeout);
    }

    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const showSuccess = (title: string, subtitle?: string): string => {
    return addNotification({
      type: 'success',
      title,
      subtitle,
      timeout: 4000,
    });
  };

  const showError = (title: string, subtitle?: string): string => {
    return addNotification({
      type: 'error',
      title,
      subtitle,
      timeout: 8000, // Longer timeout for errors
    });
  };

  const showWarning = (title: string, subtitle?: string): string => {
    return addNotification({
      type: 'warning',
      title,
      subtitle,
      timeout: 6000,
    });
  };

  const showInfo = (title: string, subtitle?: string): string => {
    return addNotification({
      type: 'info',
      title,
      subtitle,
      timeout: 5000,
    });
  };

  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  );
};

interface NotificationContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onClose,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <ToastNotification
          key={notification.id}
          kind={notification.type}
          title={notification.title}
          subtitle={notification.subtitle}
          timeout={notification.timeout}
          hideCloseButton={notification.hideCloseButton}
          lowContrast={notification.lowContrast}
          onClose={() => {
            onClose(notification.id);
            notification.onClose?.();
          }}
          style={{
            position: 'fixed',
            top: `${80 + notifications.findIndex(n => n.id === notification.id) * 80}px`,
            right: '20px',
            zIndex: 9999,
            minWidth: '400px',
            maxWidth: '600px',
          }}
        />
      ))}
    </div>
  );
};