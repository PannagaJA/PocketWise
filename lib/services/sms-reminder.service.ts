import { Platform, Linking } from 'react-native';
import { formatDate, formatMoney } from '../finance/core';

export interface PickedContactResult {
  success: boolean;
  name?: string;
  phone?: string;
  reason?: 'permission_denied' | 'cancelled' | 'error' | 'unavailable';
  error?: string;
}

import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Check if the native contacts module is present in the currently running binary.
 * This prevents crashes in Expo Go or builds where expo-contacts has not yet been compiled.
 */
export function isContactsNativeModuleAvailable(): boolean {
  try {
    const nextMod = requireOptionalNativeModule('ExpoContactsNext');
    if (nextMod) return true;
    const legacyMod = requireOptionalNativeModule('ExpoContacts');
    if (legacyMod) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Request contacts permission and open the device's native contact picker.
 * Allows the user to choose a person from their phone contacts.
 */
export async function pickContactFromDevice(): Promise<PickedContactResult> {
  // Guard: if native binary doesn't have the module compiled, don't trigger the crash
  if (!isContactsNativeModuleAvailable()) {
    return {
      success: false,
      reason: 'unavailable',
      error:
        'Phone contacts picker requires a development build (npx expo run:android). You can type the customer name and mobile number manually below.',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Contacts = require('expo-contacts');

    const perm = await Contacts.requestPermissionsAsync();
    if (perm.status !== 'granted') {
      return {
        success: false,
        reason: 'permission_denied',
        error: 'Contacts permission was not granted. You can type the customer name and number manually.',
      };
    }

    if (!Contacts.Contact || typeof Contacts.Contact.presentPicker !== 'function') {
      return {
        success: false,
        reason: 'unavailable',
        error: 'Contact picker is not supported on this platform. Please enter details manually.',
      };
    }

    const contact = await Contacts.Contact.presentPicker();
    if (!contact) {
      return { success: false, reason: 'cancelled' };
    }

    let name = '';
    try {
      name = (await contact.getFullName()) || '';
    } catch {
      try {
        const given = (await contact.getGivenName()) || '';
        const family = (await contact.getFamilyName()) || '';
        name = `${given} ${family}`.trim();
      } catch {}
    }

    let phone = '';
    try {
      const phones = await contact.getPhones();
      if (phones && phones.length > 0) {
        phone = phones[0].number || '';
      }
    } catch {}

    // Clean up phone number (retain digits and +)
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();

    return {
      success: true,
      name: name.trim(),
      phone: cleanPhone,
    };
  } catch (err: any) {
    return {
      success: false,
      reason: 'error',
      error: err?.message || 'Failed to open contact picker.',
    };
  }
}

export const POCKETWISE_PREVIEW_LINK = 'https://github.com/PannagaJA/PocketWise';

/**
 * Generates customizable reminder messages for borrower repayment with automatic
 * rich preview card banner on WhatsApp & Messages.
 */
export function getReminderMessage(
  templateType: 'friendly' | 'due' | 'overdue' | 'custom',
  params: {
    personName: string;
    amountMinor: number;
    dueDate: string;
    lentDate?: string;
  }
): string {
  const name = params.personName.trim() || 'there';
  const amountStr = formatMoney(params.amountMinor);
  const dueFormatted = formatDate(params.dueDate);
  const cardLink = `\n\n📲 PocketWise Payment Reminder:\n${POCKETWISE_PREVIEW_LINK}`;

  switch (templateType) {
    case 'due':
      return `Hi ${name}, this is a gentle reminder that the ${amountStr} is due today (${dueFormatted}). Please transfer when convenient. Thank you!${cardLink}`;
    case 'overdue':
      return `Hi ${name}, following up regarding the ${amountStr} that was due on ${dueFormatted}. Please arrange to settle it at your earliest convenience. Thank you!${cardLink}`;
    case 'friendly':
    default:
      return `Hi ${name}, hope you are doing well! Just a quick reminder about the ${amountStr} due on ${dueFormatted}. Please let me know once settled. Thank you!${cardLink}`;
  }
}

/**
 * Opens the native SMS composer with pre-filled recipient and message body.
 * On Android, smsto: explicitly targets SMS apps and populates the message text.
 * On iOS, sms:<phone>&body=<message> is used.
 */
export async function openSmsComposer(phoneNumber: string, message: string): Promise<boolean> {
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
  const encodedBody = encodeURIComponent(message.trim());

  // On Android, 'smsto:' routes directly to SMS apps and guarantees the body is pre-filled.
  // 'sms:' often opens the system app chooser which strips the message body.
  const url =
    Platform.OS === 'ios'
      ? (cleanPhone ? `sms:${cleanPhone}&body=${encodedBody}` : `sms:&body=${encodedBody}`)
      : (cleanPhone ? `smsto:${cleanPhone}?body=${encodedBody}` : `sms:?body=${encodedBody}`);

  try {
    await Linking.openURL(url);
    return true;
  } catch (err) {
    // Fallback: try alternate android sms: scheme with ?body=
    try {
      const fallbackUrl = cleanPhone
        ? `sms:${cleanPhone}?body=${encodedBody}`
        : `sms:?body=${encodedBody}`;
      await Linking.openURL(fallbackUrl);
      return true;
    } catch {
      throw new Error('Unable to open SMS application on this device.');
    }
  }
}

/**
 * Opens WhatsApp directly to the recipient's chat with the message pre-filled.
 */
export async function openWhatsAppComposer(phoneNumber: string, message: string): Promise<boolean> {
  let digits = phoneNumber.replace(/[^\d]/g, '');
  // Default to Indian country code (91) if 10-digit number without country code
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  const encodedBody = encodeURIComponent(message.trim());
  const whatsappAppUrl = `whatsapp://send?phone=${digits}&text=${encodedBody}`;
  const whatsappWebUrl = `https://wa.me/${digits}?text=${encodedBody}`;

  try {
    const canOpen = await Linking.canOpenURL(whatsappAppUrl).catch(() => false);
    if (canOpen) {
      await Linking.openURL(whatsappAppUrl);
      return true;
    }
    await Linking.openURL(whatsappWebUrl);
    return true;
  } catch {
    await Linking.openURL(whatsappWebUrl);
    return true;
  }
}
