export const snowflake = '^\\d{16,20}$'; // Discord
export const url = '^https?://\\S+$';

// Twitch usernames are always lowercase, while the display name contains the
// arbitrarily capitalized version
export const twitchUsername = '^[a-z0-9]\\w{3,24}$';

// Longest game ID I found was 10 digits, but to be safe:
export const twitchGameId = '^\\d{1,15}$';

// Longest user ID I found was 9 digits
export const twitchUserId = '^\\d{1,15}$';