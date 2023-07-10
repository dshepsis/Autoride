import { postOTDAnnouncements } from '../util/otdUtils.mjs';

export const name = 'postOTD';

// 10 minutes. On-this-day announcements are only automatically posted once per
// day, just past midnight, so it's okay if they're 10 minutes late.
export const interval_ms = 10 * 60_000;
export const enabled = true;
export const initialDelay_ms = 5_000;

// Update all the stream messages is all the guilds the bot is in.
export async function execute(client) {
	await postOTDAnnouncements(client);
}