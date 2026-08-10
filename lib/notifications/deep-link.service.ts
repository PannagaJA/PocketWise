import { router } from 'expo-router';
import Constants from 'expo-constants';

export type NotificationRouteType = 'subscription' | 'bill' | 'budget' | 'goal' | 'transaction';

const isExpoGo = Constants?.executionEnvironment === 'storeClient';

let pendingRoute: string | null = null;
let isAppLockedState = false;

function getNotificationsModule() {
  if (isExpoGo) return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

export const deepLinkService = {
  setLockedState(isLocked: boolean) {
    isAppLockedState = isLocked;
    if (!isLocked && pendingRoute) {
      const routeToDispatch = pendingRoute;
      pendingRoute = null;
      this.dispatchRoute(routeToDispatch);
    }
  },

  getPendingRoute(): string | null {
    return pendingRoute;
  },

  clearPendingRoute() {
    pendingRoute = null;
  },

  getRouteFromPayload(type?: string, referenceId?: string): string {
    switch (type) {
      case 'subscription':
        return '/(tabs)/subscriptions';
      case 'bill':
        return '/bills';
      case 'budget':
        return '/(tabs)/budgets';
      case 'goal':
        return '/goals';
      case 'transaction':
        return '/(tabs)/transactions';
      default:
        return '/(tabs)';
    }
  },

  handleNotificationResponse(response: any) {
    const data = response?.notification?.request?.content?.data || {};
    const type = typeof data.type === 'string' ? data.type : typeof data.route === 'string' ? data.route : undefined;
    const referenceId = typeof data.reference_id === 'string' ? data.reference_id : typeof data.referenceId === 'string' ? data.referenceId : undefined;
    const targetRoute = this.getRouteFromPayload(type, referenceId);

    if (isAppLockedState) {
      pendingRoute = targetRoute;
    } else {
      this.dispatchRoute(targetRoute);
    }
  },

  dispatchRoute(route: string) {
    try {
      router.push(route as any);
    } catch (err) {
      console.warn('Could not dispatch notification route:', err);
    }
  },

  async checkColdStartNotification() {
    if (isExpoGo) return;
    try {
      const Notifications = getNotificationsModule();
      if (!Notifications) return;
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) {
        this.handleNotificationResponse(response);
      }
    } catch (err) {
      console.warn('Error checking cold start notification:', err);
    }
  },

  registerNotificationListener() {
    if (isExpoGo) return () => {};
    try {
      const Notifications = getNotificationsModule();
      if (!Notifications) return () => {};
      const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
        this.handleNotificationResponse(response);
      });

      return () => {
        subscription.remove();
      };
    } catch {
      return () => {};
    }
  },
};
