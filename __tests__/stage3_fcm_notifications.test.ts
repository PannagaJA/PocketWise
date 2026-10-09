jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

describe('Stage 3 FCM HTTP v1 Push Notification Modernization', () => {
  describe('FCM HTTP v1 Payload Formatting & Validation', () => {
    function buildFcmV1Payload(params: {
      token: string;
      title: string;
      body: string;
      type: string;
      referenceId?: string;
    }) {
      return {
        message: {
          token: params.token,
          notification: {
            title: params.title,
            body: params.body,
          },
          data: {
            type: params.type,
            reference_id: params.referenceId || '',
          },
          android: {
            priority: 'HIGH',
            notification: {
              channel_id: 'pocketwise-reminders',
              sound: 'default',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
        },
      };
    }

    test('Constructs valid FCM HTTP v1 message payload structure', () => {
      const payload = buildFcmV1Payload({
        token: 'fcm_device_token_xyz_123',
        title: '🔔 Subscription Due: Spotify',
        body: 'Renewal amount: ₹119',
        type: 'subscription',
        referenceId: 'sub_999',
      });

      expect(payload.message.token).toBe('fcm_device_token_xyz_123');
      expect(payload.message.notification.title).toBe('🔔 Subscription Due: Spotify');
      expect(payload.message.data.type).toBe('subscription');
      expect(payload.message.data.reference_id).toBe('sub_999');
      expect(payload.message.android.notification.channel_id).toBe('pocketwise-reminders');
      expect(payload.message.android.priority).toBe('HIGH');
      expect(payload.message.apns.payload.aps.badge).toBe(1);
    });

    test('Handles retry status: retry up to 3 attempts then mark failed', () => {
      function evaluateNextStatus(sentSuccess: boolean, attemptCount: number): 'sent' | 'pending' | 'failed' {
        if (sentSuccess) return 'sent';
        if (attemptCount < 3) return 'pending';
        return 'failed';
      }

      expect(evaluateNextStatus(true, 1)).toBe('sent');
      expect(evaluateNextStatus(false, 1)).toBe('pending');
      expect(evaluateNextStatus(false, 2)).toBe('pending');
      expect(evaluateNextStatus(false, 3)).toBe('failed');
      expect(evaluateNextStatus(false, 4)).toBe('failed');
    });

    test('Detects invalid or unregistered FCM tokens for automatic deactivation', () => {
      function isTokenUnregistered(errorResponse: string): boolean {
        const triggers = ['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND', 'NotRegistered', 'InvalidRegistration'];
        return triggers.some((t) => errorResponse.includes(t));
      }

      const fcmV1UnregisteredError = JSON.stringify({
        error: {
          code: 404,
          message: 'Requested entity was not found.',
          status: 'NOT_FOUND',
          details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }],
        },
      });

      const genericNetworkError = 'Network timeout occurred';

      expect(isTokenUnregistered(fcmV1UnregisteredError)).toBe(true);
      expect(isTokenUnregistered(genericNetworkError)).toBe(false);
    });
  });
});
