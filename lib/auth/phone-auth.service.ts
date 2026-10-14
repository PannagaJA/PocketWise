import { supabase } from '../supabase';

export interface NormalizedPhone {
  fullPhone: string;       // e.g. "+919876543210"
  formattedDisplay: string; // e.g. "+91 98765 43210"
  authEmail: string;       // e.g. "p919876543210@pocketwise.internal"
  digits: string;          // e.g. "9876543210"
}

export const phoneAuthService = {
  /**
   * Internal deterministic secret generator so 4-digit PINs (e.g. "1234")
   * conform to Supabase's >= 6 character requirement without user hassle.
   */
  hashPin(pin: string): string {
    return `pw_pin_${pin.trim()}_secure`;
  },

  /**
   * Formats a 10-digit number into "98765 43210" for readable input
   */
  formatInput(raw: string): string {
    const cleaned = raw.replace(/\D/g, '').slice(0, 10);
    if (cleaned.length <= 5) return cleaned;
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  },

  /**
   * Validates and normalizes phone number
   */
  normalize(rawPhone: string, countryCode = '+91'): NormalizedPhone {
    const digitsOnly = rawPhone.replace(/\D/g, '');
    const cleanCode = countryCode.replace(/\D/g, '');

    let nationalDigits = digitsOnly;
    if (digitsOnly.startsWith(cleanCode) && digitsOnly.length > cleanCode.length) {
      nationalDigits = digitsOnly.slice(cleanCode.length);
    } else if (digitsOnly.startsWith('0')) {
      nationalDigits = digitsOnly.slice(1);
    }

    if (nationalDigits.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    const fullPhone = `+${cleanCode}${nationalDigits}`;
    const formattedDisplay = `+${cleanCode} ${nationalDigits.slice(0, 5)} ${nationalDigits.slice(5)}`;
    // Canonical synthetic email for zero-cost Supabase Auth identity
    const authEmail = `p${cleanCode}${nationalDigits}@pocketwise.internal`;

    return {
      fullPhone,
      formattedDisplay,
      authEmail,
      digits: nationalDigits,
    };
  },

  /**
   * Sign In with Mobile Number and 4+ digit Security PIN
   */
  async signInWithPhone(rawPhone: string, pin: string, countryCode = '+91') {
    const { authEmail } = this.normalize(rawPhone, countryCode);

    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      throw new Error('Security PIN must be at least 4 digits.');
    }

    // Try transformed PIN first (supports 4-digit PINs with Supabase)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: this.hashPin(cleanPin),
    });

    if (error) {
      // Fallback for any legacy accounts with raw password >= 6
      if (cleanPin.length >= 6) {
        const rawAttempt = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: cleanPin,
        });
        if (!rawAttempt.error && rawAttempt.data) {
          return rawAttempt.data;
        }
      }

      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Incorrect mobile number or PIN. Please check your credentials.');
      }
      throw error;
    }

    return data;
  },

  /**
   * Sign Up / Register with Mobile Number and 4+ digit Security PIN
   */
  async signUpWithPhone(
    name: string,
    rawPhone: string,
    pin: string,
    countryCode = '+91'
  ) {
    if (!name.trim()) {
      throw new Error('Please enter your full name.');
    }

    const { authEmail, fullPhone } = this.normalize(rawPhone, countryCode);

    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      throw new Error('Security PIN must be at least 4 digits.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: this.hashPin(cleanPin),
      options: {
        data: {
          display_name: name.trim(),
          phone_number: fullPhone,
        },
      },
    });

    if (error) {
      if (
        error.message.includes('already registered') ||
        error.message.includes('User already registered')
      ) {
        throw new Error('This mobile number is already registered. Please sign in instead.');
      }
      throw error;
    }

    return data;
  },
};
