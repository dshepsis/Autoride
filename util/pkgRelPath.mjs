import { fileURLToPath } from 'url';
import { join } from 'node:path';

// We have to use two ..'s here because the first one takes you from this
// module's filename to /util/, and the second one takes you to the pkg root:
const RELATIVE_PATH_FROM_THIS_MODULE_TO_PACKAGE_ROOT = '../..';
/**
 * Accepts a relative path (relative to the package root), and returns the
 * corresponding absolute path.
 * @param {string} relativePath A relative path (starting with ./ or ../) from
 * the package root (the location of package.json and index.mjs) to the desired
 * resource
 * @returns The absolute path for the desired resource
 */
export function pkgRelPath(relativePath) {
	return join(
		fileURLToPath(import.meta.url),
		RELATIVE_PATH_FROM_THIS_MODULE_TO_PACKAGE_ROOT,
		relativePath,
	);
}