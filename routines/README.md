# Description
Routines are basically code that run at a set interval for as long as the bot
is online. For example, Autoride stores a set of links to check frequently
to see if any of them give HTTP errors (e.g. 404). If any of them do, a message
is sent to a designated channel. This is useful for monitoring the stability of
various sites, tools, and resources. 

Each routine has these properties:
* `name` — A string name to identify/describe the routine in logs and error
messages.
* `interval_ms` — Determines how many milliseconds are waited between calls.
This interval is not actually precise and can vary widely if the bot is busy
with other tasks.
* `execute` method — Receives the Discord.js `client` object, in order to
send messages based on its results. 
* `enabled` (optional) — If undefined or truthy, this routine will be run at the
specified interval. If falsy, this routine will not be run at all.