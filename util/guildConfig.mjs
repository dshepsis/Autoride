// This module provides utilities for retrieving and mutating configuration data
// on a per-guild basis. Each configuration object is identified by a namespace,
// and stored as a JSON object.
//
// Note: This is mostly meant to serve as a replacement for Keyv, but using
// the normal filesystem instead of SQLite. I figure this will make inspecting
// and debugging things easier if you can just read the JSON data.
import * as fsp from 'node:fs/promises';
import * as nodePath from 'node:path';
import { pkgRelPath } from './pkgRelPath.mjs';

/**
 * Stores a cache of objects parsed from JSON files representing the config data
 * for the given guild and namespace. importJSON.mjs isn't used here, because
 * that module assumes that the underlying file doesn't get mutated
 */
const objCache = new Map();
// Cache keys are formed by simple concatenation:
function getCacheKey(guildId, namespace) {
	return guildId + namespace;
}

/**
 * Get the location of the config JSON file for a given guild and namespace.
 * The path returned is absolute, but defined relative to the package root
 * (where package.json and index.mjs live).
 * @param {string} guildId The discord.js snowflake Id of the guild the given
 * config file is for.
 * @param {string} namespace An identifier signifying what kind of configuration
 * data this config file holds.
 */
function getConfigFilePath(guildId, namespace) {
	// We have to use string concatenation here instead of just using
	// nodePath.join('.', 'guild-config', etc.), because path.join automatically
	// removes leading single-dots
	const relPathStart = `.${nodePath.sep}`;
	const configPath = nodePath.join('guild-config', guildId, namespace);
	return pkgRelPath(relPathStart + configPath + '.json');
}
/**
 * Get the location of the config directory for a given guild.
 * The path returned is absolute, but defined relative to the package root
 * (where package.json and index.mjs live).
 * @param {string} guildId The discord.js snowflake Id of the guild the given
 * config directory (full of config .json files) is for.
 */
function getConfigDirPath(guildId) {
	const relPathStart = `.${nodePath.sep}`;
	const configPath = nodePath.join('guild-config', guildId);
	return pkgRelPath(relPathStart + configPath + '/');

}

/**
 * Load a JSON config file for a given guild and namespace, returning the parsed
 * object.
 * @param {string} guildId The discord.js snowflake Id of the guild the given
 * config file is for.
 * @param {string} namespace An identifier signifying what kind of configuration
 * data this config file holds.
 * @returns {(object|undefined)} Returns the object containing the deserialized
 * config data for the requested guildId and namespace, or undefined if no such
 * config data has yet been created using the set function of this module.
 * @throws {Error} Throws an error if the content of the corresponding file is
 * not a valid JSON-parseable string. This should only happen if the file was
 * manually edited
 */
export async function get(guildId, namespace) {
	const cacheKey = getCacheKey(guildId, namespace);
	const cachedObj = objCache.get(cacheKey);
	if (cachedObj) {
		return cachedObj;
	}
	const configFilePath = getConfigFilePath(guildId, namespace);
	let configFileContents;
	try {
		configFileContents = await fsp.readFile(configFilePath);
	}
	catch (fileReadingError) {
		// If the file doesn't exist, return undefined. This matches the behavior of
		// Keyv.
		return undefined;
	}
	let parsedObj;
	try {
		parsedObj = JSON.parse(configFileContents);
	}
	catch (JSONParseError) {
		throw new Error(
			`The guild config file at path "${configFilePath}" was not a valid JSON file. To fix this, try checking that the guildId and namespace are correct, and that the file at this location is what you expect.`,
			{ cause: JSONParseError }
		);
	}
	objCache.set(cacheKey, parsedObj);
	return parsedObj;
}

/**
 * Set a given object as holding the configuration data for the given guild
 * and namespace, and write it to disc as a JSON file. This is used to store
 * specific configurable information used by the bot, such as which roles in a
 * guild count as color roles for the color command.
 * @param {string} guildId The discord.js snowflake Id of the guild the given
 * config object is for.
 * @param {string} namespace An identifier signifying what kind of configuration
 * data this config object holds.
 * @param {object} configObj A JSON-serializable object representing some
 * configuration data for the given guildId and namespace.
 */
export async function set(guildId, namespace, configObj) {
	const cacheKey = getCacheKey(guildId, namespace);
	objCache.set(cacheKey, configObj);

	// Write the changed file to disc
	let serializedObj;
	try {
		serializedObj = JSON.stringify(configObj, null, 2);
	}
	catch (JSONSerializeError) {
		throw new Error(
			`The guild config object given for guildId "${guildId}" and namespace "${namespace} can't be serialized in JSON. To fix this, remove any BigInts or circular references.`,
			{ cause: JSONSerializeError }
		);
	}
	const configDirPath = getConfigDirPath(guildId);
	const configFilePath = getConfigFilePath(guildId, namespace);
	// In case the requisite folders don't already exist, create them:
	await fsp.mkdir(configDirPath, { recursive: true });

	// Create or overwrite the selected config file:
	await fsp.writeFile(configFilePath, serializedObj);

	// "Returns a promise that resolves to true", matching the behavior of
	// keyv.set()
	return true;
}