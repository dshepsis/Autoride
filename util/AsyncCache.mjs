/**
 * A cache in front of an asynchronous mapping function. For example, you can
 * pass in an async function for reading a file off disc, and the constructed
 * AsyncCache will automatically cache files the first time their read, so
 * future reads to the same key (the path) would load from memory rather than
 * disc.
 * @template K,V
 */
export class AsyncCache {
	/** @type {Map<K, V>} */
	#map = new Map();
	/** @type {(key: K) => Promise<V>} */
	#onMiss;

	/**
	 * @param {(key: K) => Promise<V>} onMiss An async function mapping keys to
	 * values. This function should be deterministic. It is called only when the
	 * result is not cached, or when `fetchForceMiss` is called.
	 */
	constructor(onMiss) {
		this.#onMiss = onMiss;
	}

	/**
	 * Calls the given `onMiss` function and caches the result:
	 * @param {K} key
	 * @returns {Promise<V>}
	 */
	async fetchForceMiss(key) {
		const missResult = await this.#onMiss(key);
		this.#map.set(key, missResult);
		return missResult;
	}

	/**
	 * Checks if there is a cached result for the given key. If so, returns it.
	 * Otherwise, calls the given `onMiss` function and caches the result:
	 * @param {K} key
	 * @returns {Promise<V>}
	 */
	async fetch(key) {
		const cacheResult = this.#map.get(key);
		if (cacheResult === undefined) {
			return await this.fetchForceMiss(key);
		}
		return cacheResult;
	}
}