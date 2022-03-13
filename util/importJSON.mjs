import { readFile } from 'node:fs/promises';
import * as nodePath from 'node:path';

// We keep the parsed JSON objects in a map in memory, so that we don't have to
// read from disc. The downside is that we don't do any cache invalidation, so
// we are assuming that the underlying file never changes, but that's generally
// fine for this purpose.
const objCache = new Map();

export async function importJSON(jsonPath) {
	const pathExt = nodePath.extname(jsonPath);
	if (pathExt !== '.json') {
		throw new Error(`Path must have a ".json" extension. Instead found ${pathExt}. To fix this, use a path to a .json file instead.`);
	}
	if (!nodePath.isAbsolute(jsonPath)) {
		throw new Error('Path of imported JSON file must be absolute. To fix this, use the util/pkgRelPath function.');
	}
	const cachedObj = objCache.get(jsonPath);
	if (cachedObj) {
		return cachedObj;
	}
	const contents = await readFile(jsonPath, { encoding: 'utf8' });
	let parsedObj;
	try {
		parsedObj = JSON.parse(contents);
	}
	catch (error) {
		throw new Error(
			`The file at path "${jsonPath}" was not a valid JSON file`,
			{ cause: error }
		);
	}
	objCache.set(jsonPath, parsedObj);
	return parsedObj;
}