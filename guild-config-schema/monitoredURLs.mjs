import * as patterns from './schema-util/patterns.mjs';

export const name = 'monitoredURLs';

export const schema = {
	description: `An array of objects containing data on each URL being monitored,
	the channel in which to report errors, and who to @mention in those reports`,
	type: 'array',
	uniqueItems: true,
	items: {
		description: 'A monitored URL data object',
		type: 'object',
		additionalProperties: false,
		required: ['url', 'enabled', 'notifyChannels'],
		properties: {
			url: {
				type: 'string',
				description: 'The URL being monitored',
				pattern: patterns.url,
			},
			enabled: {
				type: 'boolean',
				description: 'Iff true, the URL is tested periodically for errors.',
			},
			notifyChannels: {
				description: `An object mapping from channel IDs to objects containing
				data on who to notify in that channel of errors of the URL`,
				type: 'object',
				additionalProperties: false,
				patternProperties: {
					[patterns.snowflake]: {
						description: `An object containing data on who to notify and a short
						info note of to include in any error message`,
						type: 'object',
						additionalProperties: false,
						required: ['userIds'],
						properties: {
							userIds: {
								description: 'An array of ids of users to notify of errors',
								type: 'array',
								uniqueItems: true,
								minItems: 1,
								items: {
									type: 'string',
									pattern: patterns.snowflake,
								},
							},
							info: {
								description: 'A short note to include with error messages',
								type: 'string',
							},
						},
					},
				},
			},
		},
	},
};

export function makeDefault() {
	return [];
}

export const example = [
	{
		url: 'http://example.com',
		enabled: false,
		notifyChannels: {
			'123456789123456788': {
				userIds: [
					'223456789123456789',
				],
			},
		},
	},
	{
		url: 'https://www.coolExample.com',
		enabled: true,
		notifyChannels: {
			'123456789123456789': {
				userIds: [
					'323456789123456789',
				],
				info: 'That cool website',
			},
		},
	},
];