const { createRoleSelector } = require('./command-util/roleSelector.js');

module.exports = createRoleSelector({
	name: 'colors',
	description: 'Select which you want your username to be displayed in.',
	roles: {
		Red: '932359945070989353',
		Green: '932360425050345473',
		Blue: '932360281747779615',
	},
});