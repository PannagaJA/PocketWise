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
  if (Platform.OS === 'android') return true;
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
  // 1. Android Native Direct Picker (Fastest, cleanest & guaranteed to return name + phone)
  if (Platform.OS === 'android') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { NativeModules } = require('react-native');
      const smsMod = NativeModules.PocketWiseSmsModule;
      if (smsMod && typeof smsMod.pickContact === 'function') {
        const nativeResult = await smsMod.pickContact();
        if (!nativeResult) {
          return { success: false, reason: 'cancelled' };
        }
        const name = (nativeResult.name || '').trim();
        const rawPhone = (nativeResult.phone || '').trim();
        const cleanPhone = rawPhone.replace(/[\s\-\(\)]/g, '').trim();

        if (name || cleanPhone) {
          return {
            success: true,
            name,
            phone: cleanPhone,
          };
        }
      }
    } catch (e: any) {
      console.warn('[ContactPicker] Native pickContact error, attempting expo-contacts fallback:', e);
    }
  }

  // 2. Fallback to expo-contacts (iOS and fallback)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Contacts = require('expo-contacts');

    if (Contacts.requestPermissionsAsync) {
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        return {
          success: false,
          reason: 'permission_denied',
          error: 'Contacts permission was not granted. You can type the customer name and number manually.',
        };
      }
    }

    let contact: any = null;

    // Try modern Contact.presentPicker()
    if (Contacts.Contact && typeof Contacts.Contact.presentPicker === 'function') {
      try {
        contact = await Contacts.Contact.presentPicker();
      } catch (e) {
        console.warn('[ContactPicker] Contact.presentPicker threw:', e);
      }
    }

    // Try legacy presentContactPickerAsync if modern returned nothing
    if (!contact) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const legacyContacts = require('expo-contacts/legacy');
        if (typeof legacyContacts?.presentContactPickerAsync === 'function') {
          contact = await legacyContacts.presentContactPickerAsync();
        }
      } catch (e) {
        console.warn('[ContactPicker] legacy presentContactPickerAsync threw:', e);
      }
    }

    if (!contact) {
      return { success: false, reason: 'cancelled' };
    }

    let name = '';
    // Check direct name properties
    if (typeof contact.name === 'string' && contact.name.trim()) {
      name = contact.name.trim();
    } else if (typeof contact.fullName === 'string' && contact.fullName.trim()) {
      name = contact.fullName.trim();
    } else if (typeof contact.displayName === 'string' && contact.displayName.trim()) {
      name = contact.displayName.trim();
    }

    // Check async getter methods
    if (!name && typeof contact.getFullName === 'function') {
      try {
        name = (await contact.getFullName()) || '';
      } catch {}
    }

    if (!name && typeof contact.getGivenName === 'function') {
      try {
        const given = (await contact.getGivenName()) || '';
        const family = typeof contact.getFamilyName === 'function' ? (await contact.getFamilyName()) || '' : '';
        name = `${given} ${family}`.trim();
      } catch {}
    }

    if (!name && (contact.firstName || contact.givenName || contact.lastName || contact.familyName)) {
      const first = contact.firstName || contact.givenName || '';
      const last = contact.lastName || contact.familyName || '';
      name = `${first} ${last}`.trim();
    }

    let phone = '';
    // Check direct phone properties
    if (Array.isArray(contact.phoneNumbers) && contact.phoneNumbers.length > 0) {
      phone = contact.phoneNumbers[0]?.number || contact.phoneNumbers[0]?.digits || '';
    } else if (Array.isArray(contact.phones) && contact.phones.length > 0) {
      phone = contact.phones[0]?.number || (typeof contact.phones[0] === 'string' ? contact.phones[0] : '');
    }

    // Check async getter methods
    if (!phone && typeof contact.getPhones === 'function') {
      try {
        const phones = await contact.getPhones();
        if (Array.isArray(phones) && phones.length > 0) {
          phone = phones[0]?.number || '';
        }
      } catch {}
    }

    // Check getDetails method if available
    if ((!name || !phone) && typeof contact.getDetails === 'function') {
      try {
        const details = await contact.getDetails(['fullName', 'givenName', 'familyName', 'phones']);
        if (!name && details) {
          name = details.fullName || `${details.givenName || ''} ${details.familyName || ''}`.trim();
        }
        if (!phone && details?.phones && details.phones.length > 0) {
          phone = details.phones[0]?.number || '';
        }
      } catch {}
    }

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

/**
 * Generates customizable reminder messages for borrower repayment.
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

  switch (templateType) {
    case 'due':
      return `Hi ${name}, this is a gentle reminder that the ${amountStr} is due today (${dueFormatted}). Please transfer when convenient. Thank you! - via PocketWise`;
    case 'overdue':
      return `Hi ${name}, following up regarding the ${amountStr} that was due on ${dueFormatted}. Please arrange to settle it at your earliest convenience. Thank you! - via PocketWise`;
    case 'friendly':
    default:
      return `Hi ${name}, hope you are doing well! Just a quick reminder about the ${amountStr} due on ${dueFormatted}. Please let me know once settled. Thank you! - via PocketWise`;
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
