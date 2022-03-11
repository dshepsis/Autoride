import { readFile } from 'node:fs/promises';
import { extname, isAbsolute } from 'node:path';

const objCache = new Map();

export async function importJSON(path) {
	const pathExt = extname(path);
	if (pathExt !== '.json') {
		throw new Error(`Path must have a ".json" extension. Instead found ${pathExt}. To fix this, use a path to a .json file instead.`);
	}
	if (!isAbsolute(path)) {
		throw new Error('Path of imported JSON file must be absolute. To fix this, use the node:path.resolve function.');
	}
	const cachedObj = objCache.get(path);
	if (cachedObj) {
		return cachedObj;
	}
	const contents = await readFile(path, { encoding: 'utf8' });
	let parsedObj;
	try {
		parsedObj = JSON.parse(contents);
	}
	catch (error) {
		throw new Error(
			`The file at path "${path}" was not a valid JSON file`,
			{ cause: error }
		);
	}
	objCache.set(path, parsedObj);
	return parsedObj;
}