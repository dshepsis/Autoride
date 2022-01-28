const Keyv = require('keyv');

const testDB = new Keyv('sqlite://test.sqlite', { namespace: 'test' });
testDB.on('error', err => console.log('Connection Error', err));

(async () => {
	const values = ['Normal string value', 1, true, Symbol('Symbol value'), 1n, { foo: Symbol('Nested symbol value') }, { [Symbol('Symbol key')]: 'bar' }];
	for (const value of values) {
		try {
			await testDB.set('key', value);
			console.log('Success: ', await testDB.get('key'));
		}
		catch (error) {
			console.log('Failure: ', error);
		}
	}
})();