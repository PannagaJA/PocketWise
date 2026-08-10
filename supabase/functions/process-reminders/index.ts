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
      // Mark as processing (idempotency check)
      await supabase
        .from('reminders')
        .update({ status: 'processing', attempt_count: reminder.attempt_count + 1 })
        .eq('id', reminder.id);

      // Fetch active device FCM tokens for the user
      const { data: devices } = await supabase
        .from('devices')
        .select('fcm_token')
        .eq('user_id', reminder.user_id)
        .eq('is_active', true);

      let sentSuccess = false;

      for (const dev of devices || []) {
        if (!FCM_SERVER_KEY) break;

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

        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${FCM_SERVER_KEY}`,
          },
          body: JSON.stringify(fcmPayload),
        });

        if (res.ok) sentSuccess = true;
      }

      // Update final status
      await supabase
        .from('reminders')
        .update({
          status: sentSuccess ? 'sent' : 'failed',
          sent_at: sentSuccess ? new Date().toISOString() : null,
        })
        .eq('id', reminder.id);

      results.push({ reminder_id: reminder.id, success: sentSuccess });
    }

    return new Response(JSON.stringify({ processed: results.length, details: results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
