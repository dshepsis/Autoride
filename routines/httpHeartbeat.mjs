import { testUrl } from '../util/fetchUtils.mjs';

import { pkgRelPath } from '../util/pkgRelPath.mjs';
import { importJSON } from '../util/importJSON.mjs';
const { heartbeatURL } = await importJSON(pkgRelPath('./config.json'));

// Sends a heartbeat HTTP request to a desired URL every 5 minutes
const MS_PER_MIN = 60 * 1000;
export const name = 'HTTP Heartbeat';

export const initialDelay_ms = 1 * MS_PER_MIN; // 1 minute
export const interval_ms = 5 * MS_PER_MIN; // 5 minutes

export const enabled = !!heartbeatURL;
export async function execute() {
	const pingResponse = await testUrl(heartbeatURL);
	if (!pingResponse.isOK) {
		console.error(`Experienced an error when sending heartbeat to ${heartbeatURL}: `, pingResponse);
	}
	return;
}