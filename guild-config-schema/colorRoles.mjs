import { snowflake as snowflakePattern } from './schema-util/patterns.mjs';

export const name = 'colorRoles';

export const schema = {
	description: `An object mapping from role ID's to objects containing names
	and messages`,
	type: 'object',
	additionalProperties: false,
	patternProperties: {
		[snowflakePattern]: {
			description: 'The snowflake ID for a given role',
			type: 'object',
			additionalProperties: false,
			required: ['name'],
			properties: {
				name: {
					type: 'string',
					description: 'The role\'s name',
				},
				message: {
					type: 'string',
					description: 'A message shown when the role is selected',
				},
			},
		},
	},
};

export function makeDefault() {
	return {};
}

export const example = {
	'123456789123456787': {
		name: 'Red',
		message: 'This is the red role message',
	},
	'123456789123456788': {
		name: 'Green',
		message: 'The green role also has a message',
	},
	'123456789123456789': {
		name: 'Blue',
	},
};