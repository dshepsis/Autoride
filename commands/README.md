# Description
Commands are modules which contain information and behavior for discord.js slash
commands. Each module exports a `data` property and an `execute` method. The
data property is a `@discordjs/Builders.SlashCommandBuilder`, which declares
the name, description, parameters etc. of the command. The execute method is a
function which receives a `discord.js.BaseCommandInteraction`.

They can also have an optional property `minimumPrivilege`, which should have a
value exported by the `privilegeLevels` module, such as
`privilegeLevels.MASTER_USER_ONLY` or
`minimumPrivilege: privilegeLevels.byName.ADMIN`.

They can also have an optional method `onClientReady`, which is runs when the 
discord.js `client.ready` event fires. It receives the `client` object as its
only parameter. This can be used for setup.
