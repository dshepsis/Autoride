# Description
Routines are basically code that run at a set interval for as long as the bot
is online. For example, Autoride stores a set of links to check frequently
to see if any of them give HTTP errors (e.g. 404). If any of them do, a message
is sent to a designated channel. This is useful for monitoring the stability of
various sites, tools, and resources. 

Each routine has an `interval_ms` property, which determines how many
milliseconds are waited between calls. This interval is not actually precise
and can vary widely if the bot is busy with other tasks. Each routine also has
an `execute` method, which receives the Discord.js `client` object, in order to
send messages based on its results. 