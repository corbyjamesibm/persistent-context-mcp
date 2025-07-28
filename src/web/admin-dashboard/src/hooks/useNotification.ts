import { useNotificationContext } from '../contexts/NotificationContext';

export const useNotification = () => {
  return useNotificationContext();
};