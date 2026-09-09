/**
 * Shared ping-session configuration defaults & keys.
 * Single source of truth for screens that read/write ping preferences.
 */
export const LOG_ENABLED_KEY = '@netplus/show-ping-log';
/** Default on/off state for the ping log console when no stored value exists. */
export const LOG_ENABLED_DEFAULT = true;
export const MAX_LOG_ENTRIES = 100;