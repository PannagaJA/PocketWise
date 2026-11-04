import { router } from 'expo-router';

export type NotificationRouteType = 'subscription' | 'bill' | 'budget' | 'goal' | 'transaction';

let Platform: any = { OS: 'android' };
let Constants: any = null;
let ExecutionEnvironment: any = { StoreClient: 'storeClient' };

try {
  Platform = require('react-native').Platform;
  Constants = require('expo-constants').default || require('expo-constants');
  ExecutionEnvironment = require('expo-constants').ExecutionEnvironment || ExecutionEnvironment;
} catch {
  Platform = { OS: 'android' };
  Constants = { executionEnvironment: 'bare' };
}

const isExpoGo = Constants?.executionEnvironment === (ExecutionEnvironment?.StoreClient || 'storeClient');

let pendingRoute: string | null = null;
let pendingAction: (() => void) | null = null;
let isAppLockedState = false;

function getNotificationsModule() {
  if (isExpoGo || Platform?.OS === 'web') return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

export const deepLinkService = {
  setLockedState(isLocked: boolean) {
    isAppLockedState = isLocked;
    if (!isLocked) {
      if (pendingAction) {
        const action = pendingAction;
        pendingAction = null;
        setTimeout(action, 600);
      }
      if (pendingRoute) {
        const routeToDispatch = pendingRoute;
        pendingRoute = null;
        this.dispatchRoute(routeToDispatch);
      }
    }
  },

  getPendingRoute(): string | null {
    return pendingRoute;
  },

  clearPendingRoute() {
    pendingRoute = null;
    pendingAction = null;
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
      case 'app_update':
      case 'update':
        return '/(tabs)/more';
      default:
        return '/(tabs)';
    }
  },

  triggerAppUpdateFlow() {
    const executeFlow = () => {
      try {
        if (typeof router?.push === 'function') {
          router.push('/(tabs)/more' as any);
        }
        const { useUpdateStore } = require('../stores/updateStore');
        useUpdateStore.getState().openModal();
        useUpdateStore.getState().checkForUpdates(true).catch(() => {});
      } catch (err) {
        console.warn('[DeepLinkService] Error triggering update flow:', err);
      }
    };

    if (isAppLockedState) {
      pendingAction = executeFlow;
      pendingRoute = null;
    } else {
      executeFlow();
    }
  },

  handleNotificationResponse(response: any) {
    const data = response?.notification?.request?.content?.data || {};
    const type = typeof data.type === 'string' ? data.type : typeof data.route === 'string' ? data.route : undefined;

    if (type === 'app_update' || type === 'update') {
      this.triggerAppUpdateFlow();
      return;
    }

    const referenceId = typeof data.reference_id === 'string' ? data.reference_id : typeof data.referenceId === 'string' ? data.referenceId : undefined;
    const targetRoute = this.getRouteFromPayload(type, referenceId);

    if (isAppLockedState) {
      pendingRoute = targetRoute;
    } else {
      this.dispatchRoute(targetRoute);
    }
  },

  dispatchRoute(route: string) {
    setTimeout(() => {
      try {
        if (typeof router?.push === 'function') {
          router.push(route as any);
        }
      } catch (err) {
        console.warn('Could not dispatch notification route:', err);
      }
    }, 500);
  },

  async checkColdStartNotification() {
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
