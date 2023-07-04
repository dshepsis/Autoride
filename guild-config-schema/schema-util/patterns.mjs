export const snowflake = '^\\d{16,20}$'; // Discord
export const url = '^https?://\\S+$';

// Twitch usernames are always lowercase, while the display name contains the
// arbitrarily capitalized version
export const twitchUsername = '^[a-z0-9]\\w{3,24}$';

// Longest game ID I found was 10 digits, but to be safe:
export const twitchGameId = '^\\d{1,15}$';

// Longest user ID I found was 9 digits
export const twitchUserId = '^\\d{1,15}$';

// Used by the onThisDay.mjs schema. dayOfMonth does not allow a 10s digit of 0
// because it represents a stringified array index. readableDate, on the other
// hand, represents a date produced by
// `Intl.DateTimeFormat('en-GB', {day: "2-digit", month: "long", year: "numeric"})`,
// so a leading 0 is required for days 1-9.
export const dayOfMonth = '^[12]?\\d|3[01]$';
export const readableDate = '^[012]\\d|3[01] (January|February|March|April|May|June|July|August|September|October|November|December) \\d+$'