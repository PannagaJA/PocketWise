import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
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
      let lastError = null;

      for (const dev of devices || []) {
        if (!FCM_SERVER_KEY) {
          lastError = 'FCM_SERVER_KEY not configured';
          break;
        }

        const fcmPayload = {
          to: dev.fcm_token,
          notification: {
            title: reminder.title,
            body: reminder.body,
            sound: 'default',
          },
          data: {
            type: reminder.type,
            reference_id: reminder.reference_id,
          },
        };

        try {
          const res = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `key=${FCM_SERVER_KEY}`,
            },
            body: JSON.stringify(fcmPayload),
          });

          if (res.ok) {
            sentSuccess = true;
          } else {
            const errJson = await res.json();
            lastError = JSON.stringify(errJson);

            // Handle invalid token deactivate logic
            if (errJson?.results?.[0]?.error === 'NotRegistered' || errJson?.results?.[0]?.error === 'InvalidRegistration') {
              await supabase
                .from('devices')
                .update({ is_active: false })
                .eq('fcm_token', dev.fcm_token);
            }
          }
        } catch (err: any) {
          lastError = err.message;
        }
      }

      // Retry policy: If failed and attempts < 3, revert to pending for next run
      let nextStatus = sentSuccess ? 'sent' : 'failed';
      if (!sentSuccess && reminder.attempt_count < 3) {
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

      results.push({ reminder_id: reminder.id, success: sentSuccess, status: nextStatus });
    }

    return new Response(JSON.stringify({ processed: results.length, details: results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
