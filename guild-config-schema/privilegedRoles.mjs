import { byOrder } from '../privilegeLevels.mjs';
import { snowflake as snowflakePattern } from './schema-util/patterns.mjs';

export const name = 'privilegedRoles';

export const schema = {
	description: `An object mapping from privilege level names as listed in 
	privilegeLevels.mjs to role ids`,
	type: 'object',
	additionalProperties: false,
	properties: Object.fromEntries(byOrder.map(level => [
		level.name,
		{
			description: 'The id of the role associated with the privilege level',
			type: 'string',
			pattern: snowflakePattern,
		},
	])),
};

export function makeDefault() {
	return {};
}

export const example = {
	OWNER: '123456789123456788',
	MOD: '123456789123456789',
};