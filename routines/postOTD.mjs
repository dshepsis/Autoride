import { postOTDAnnouncements } from "../util/otdUtils.mjs";

export const name = 'postOTD';

// 10 minutes. This is only meant 
// export const interval_ms = 10*60_000;
export const interval_ms = 60_000;
export const enabled = true;
export const initialDelay_ms = 5_000;

// Update all the stream messages is all the guilds the bot is in.
export async function execute(client) {
	await postOTDAnnouncements(client);
}