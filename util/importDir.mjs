import { readdir, lstat } from 'node:fs/promises';
import * as nodePath from 'node:path';

const dirCache = new Map();

// Dynamically imports all the modules in a given directory, and returns an
// array of their namespaces:
export async function importDir(dirPath) {
	if (!nodePath.isAbsolute(dirPath)) {
		throw new Error('Path of imported directory must be absolute. To fix this, use the node:path.resolve function.');
	}
	// Ensure that the path actually refers to a directory:
	const stat = await lstat(dirPath);
	if (!stat.isDirectory()) {
		throw new Error('Path must refer to a directory, not a file.');
	}

	const cachedDir = dirCache.get(dirPath);
	if (cachedDir) {
		return cachedDir;
	}

	// Get list of command modules from /commands directory
	const filenames = await readdir(dirPath);
	const jsFilenames = filenames.filter(path => nodePath.extname(path) === '.js');

	// Import each command module and save it to a collection
	const importPromises = [];
	for (const filename of jsFilenames) {
		const filePath = nodePath.join(dirPath, filename);
		importPromises.push(import(`file:${filePath}`));
	}

	const modules = await Promise.all(importPromises);
	dirCache.set(dirPath, modules);
	return modules.map(m => m.default);

	// Alternate version which returns object mapping from filenames to modules?
	// This would give you access to the filenames, which you don't get with the
	// above, but I'm not sure if that's necessary or helpful...
	// const modules = await Promise.all(importPromises);
	// const moduleObj = Object.create(null);
	// for (let i = 0, len = modules.length; i < len; ++i) {
	// 	moduleObj[jsFilenames[i]] = modules[i].default;
	// }
	// dirCache.set(dirPath, moduleObj);
	// return moduleObj;
}