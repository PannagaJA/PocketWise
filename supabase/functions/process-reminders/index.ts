import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const FIREBASE_SERVICE_ACCOUNT_RAW = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Base64URL encoding helper.
 */
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

/**
 * Parses PEM formatted RSA private key into CryptoKey for Web Crypto RS256 signing.
 */
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const cleanPem = pemKey
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  const binaryDer = Uint8Array.from(atob(cleanPem), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

/**
 * Generates an OAuth2 access token for FCM HTTP v1 using Google Service Account credentials.
 */
async function getGoogleOAuthAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);

  // Return cached token if valid for more than 5 minutes
  if (cachedAccessToken && cachedAccessToken.expiresAt > nowSec + 300) {
    return cachedAccessToken.token;
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: nowSec + 3600,
    iat: nowSec,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signedJwt = `${unsignedToken}.${arrayBufferToBase64Url(signatureBuffer)}`;

  // Exchange JWT assertion for OAuth2 access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Google OAuth token exchange failed: ${errText}`);
  }

  const tokenData = await tokenResponse.json();
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: nowSec + (tokenData.expires_in || 3600),
  };

  return tokenData.access_token;
}

serve(async (_req) => {
  try {
    const now = new Date().toISOString();

    // 1. Fetch pending reminders due for dispatch
    const { data: reminders, error: remErr } = await supabase
      .from('reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now);

    if (remErr) throw remErr;

    const results = [];
    let serviceAccount: ServiceAccount | null = null;

    if (FIREBASE_SERVICE_ACCOUNT_RAW) {
      try {
        serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_RAW);
      } catch (err) {
        console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT:', err);
      }
    }

    for (const reminder of reminders || []) {
      // Idempotency check: Claim reminder by setting status = 'processing'
      const { data: claimed, error: claimErr } = await supabase
        .from('reminders')
        .update({ status: 'processing', attempt_count: (reminder.attempt_count || 0) + 1 })
        .eq('id', reminder.id)
        .eq('status', 'pending')
        .select()
        .single();

      // Skip if another worker claimed this reminder concurrently
      if (claimErr || !claimed) continue;

      // Fetch active device FCM tokens for the user
      const { data: devices } = await supabase
        .from('devices')
        .select('fcm_token')
        .eq('user_id', reminder.user_id)
        .eq('is_active', true);

      let sentSuccess = false;
      let lastError: string | null = null;

      for (const dev of devices || []) {
        if (!serviceAccount) {
          lastError = 'FIREBASE_SERVICE_ACCOUNT not configured';
          break;
        }

        try {
          const accessToken = await getGoogleOAuthAccessToken(serviceAccount);
          const fcmV1Url = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

          const fcmPayload = {
            message: {
              token: dev.fcm_token,
              notification: {
                title: reminder.title,
                body: reminder.body,
              },
              data: {
                type: String(reminder.type || 'reminder'),
                reference_id: String(reminder.reference_id || ''),
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

          const res = await fetch(fcmV1Url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(fcmPayload),
          });

          if (res.ok) {
            sentSuccess = true;
          } else {
            const errJson = await res.text();
            lastError = errJson;

            // Handle invalid token deactivate logic for FCM v1 error responses
            try {
              const parsedErr = JSON.parse(errJson);
              const errorObj = parsedErr?.error || {};
              const details = errorObj.details || [];

              const hasUnregistered = details.some(
                (d: any) => d.errorCode === 'UNREGISTERED'
              );
              const hasTokenFieldViolation = details.some(
                (d: any) =>
                  Array.isArray(d.fieldViolations) &&
                  d.fieldViolations.some((fv: any) => fv.field === 'message.token')
              );

              if (hasUnregistered || hasTokenFieldViolation) {
                await supabase
                  .from('devices')
                  .update({ is_active: false })
                  .eq('fcm_token', dev.fcm_token);
              }
            } catch {
              // Non-JSON error response
            }
          }
        } catch (err: any) {
          lastError = err.message;
        }
      }

      // Retry policy: If failed and attempts < 3, revert to pending for next run
      let nextStatus = sentSuccess ? 'sent' : 'failed';
      if (!sentSuccess && (reminder.attempt_count || 0) < 3) {
        nextStatus = 'pending';
      }

      await supabase
        .from('reminders')
        .update({
          status: nextStatus,
          sent_at: sentSuccess ? new Date().toISOString() : null,
          last_error: lastError,
        })
        .eq('id', reminder.id);

      results.push({ reminder_id: reminder.id, success: sentSuccess, status: nextStatus, error: lastError });
    }

    return new Response(JSON.stringify({ processed: results.length, details: results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
