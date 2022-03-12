import { readdir, lstat } from 'node:fs/promises';
import * as nodePath from 'node:path';

const dirCache = new Map();

// Dynamically imports all the modules in a given directory, and returns an
// array of their namespaces.
// NOTE: This assumes that .js files are ES Modules. .cjs files have their
// default export returned instead of the full Module Namespace Exotic Object.
// If a .js file is actually a CommonJS file, Node will throw an error.
export async function importDir(dirPath) {
	// dirPath must be an absolute path in order for dynamic import() to succeed,
	// so we use path.resolve here.
	dirPath = nodePath.resolve(dirPath);

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

	// Accept only .js, .cjs (commonJS) and .mjs (ES Modules) files:
	const jsFilenames = filenames.filter(
		path => /\.[cm]?js/.test(nodePath.extname(path))
	);

	// Import each command module and save it to a collection
	const importPromises = [];
	for (const filename of jsFilenames) {
		const filePath = nodePath.join(dirPath, filename);

		// Use dynamic ES Modules import keyword:
		importPromises.push(import(`file:${filePath}`));
	}

	// esm import puts commonjs exports on the module.default property, so
	// we reverse that:

	const modules = (await Promise.all(importPromises)).map((m, i) => {
		// Check if the module is a CommonJS module. If so, just return the default
		// export, to better mimic the functionality of require():
		if (nodePath.extname(jsFilenames[i]) === '.cjs') {
			return m.default;
		}
		return m;
	});
	dirCache.set(dirPath, modules);
	return modules;

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