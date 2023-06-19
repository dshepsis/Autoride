import Ajv from 'ajv';

import { importDir } from '../../util/importDir.mjs';
import { pkgRelPath } from '../../util/pkgRelPath.mjs';
const schemaModules = await importDir(pkgRelPath('./guild-config-schema/'));
import { importJSON } from '../../util/importJSON.mjs';
const {
	guildIds: configGuildIds,
	developmentGuildId,
} = await importJSON(pkgRelPath('./config.json'));
const allGuildIds = [developmentGuildId, ...configGuildIds];

import { get } from '../../util/guildConfig.mjs';

/**
 * An ajv instance. Use the validation function returned by
 * `ajv.getSchema(configName)` to verify that a given object is a valid guild
 * config object for the given config (e.g. 'colorRoles').
 */
export const ajv = new Ajv();
const examples = Object.create(null);
const defaultFactories = Object.create(null);
for (const schemaModule of schemaModules) {
	const name = schemaModule.name;
	ajv.addSchema(schemaModule.schema, name);

	// Schemas added with addSchema are not automatically compiled, so use
	// getSchema to force them to compile immediately:
	ajv.getSchema(name);

	defaultFactories[name] = schemaModule.makeDefault;
	examples[name] = schemaModule.example;
}

/**
 * Returns a default/empty value for the given guild config
 * @param {string} name
 * @returns {object}
 */
export function makeDefault(name) {
	return defaultFactories[name]();
}

/**
 * Checks all the example and default values for each schema, and all the config
 * values for each guild, for validity against the corresponding guild config
 * schemas. Returns an array of TypeErrors for any errors found. If no errors
 * were found, the returned value will be an empty array.
 * @returns {Promise<TypeError[]>}
 */
export async function testSchemas() {
	const errors = [];
	for (const name in examples) {
		const validate = ajv.getSchema(name);

		const defaultValid = validate(makeDefault(name));
		if (!defaultValid) {
			errors.push(new TypeError(`The default value for schema "${name}" is invalid: ${JSON.stringify(validate.errors, null, 2)}`));
		}

		const exampleValid = validate(examples[name]);
		if (!exampleValid) {
			errors.push(new TypeError(`The example value for schema "${name}" is invalid: ${JSON.stringify(validate.errors, null, 2)}`));
		}

		for (const guildId of allGuildIds) {
			const config = await get(guildId, name);
			if (config === undefined) {
				continue;
			}
			const configValid = validate(config);
			if (!configValid) {
				errors.push(new TypeError(`The guild config "${name}" for guild "${guildId} is invalid: ${JSON.stringify(validate.errors, null, 2)}`));
			}
		}
	}
	return errors;
}