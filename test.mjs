import { testSchemas } from './guild-config-schema/schema-util/guildConfigAJV.mjs';

const errors = await testSchemas();
if (errors.length > 0) {
	console.error('WARNING: The following guild config JSON Schema errors were detected:');
	errors.forEach(console.error);
}