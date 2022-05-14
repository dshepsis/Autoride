import { updateStreamMessages } from '../util/manageTwitchUtils.mjs';

export const name = 'monitorTwitchStreams';

// 62 seconds. The Twitch Helix API is cached every minute, so requesting more
// often than every 60 seconds is pointless. The extra 2 seconds should help tp
// avoid the chance of getting a cached response.
export const interval_ms = 62_000;
export const enabled = true;
export const initialDelay_ms = 5_000;

// Update all the stream messages is all the guilds the bot is in.
export async function execute(client) {
	await updateStreamMessages(client);
}