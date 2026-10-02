// Public legal / support pages, served from the live API host.
// Keep in step with fastlane/metadata (privacy_url, support_url, marketing_url).
const LEGAL_HOST = 'https://api.trendzonow.com';

export const TERMS_URL = `${LEGAL_HOST}/terms`;
export const PRIVACY_URL = `${LEGAL_HOST}/privacy/customer`;
export const SUPPORT_URL = `${LEGAL_HOST}/support`;

/**
 * Grievance contact. There is no standalone grievance page: the privacy policy's
 * "Contact & grievances" section names this address and the response times, so
 * the Profile link opens a prefilled email to it.
 */
export const GRIEVANCE_EMAIL = 'trendzodevelopment@gmail.com';
export const GRIEVANCE_MAILTO = `mailto:${GRIEVANCE_EMAIL}?subject=${encodeURIComponent('Trendzo grievance')}`;
