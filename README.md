# Autoride
Discord JS Bot designed for the Okami Speedrunning Discord.

# Commands
These are the commands available with Autoride:
- `/colors` — Easily switch color roles with an ephemeral paginated menu.
- `/embed-message` — Direct Autoride to send a given message as an embed to the
selected channel.
- `/http-monitor` — View and change the list of URLs being monitored for HTTP
errors, and test URLs for errors.
- `/manage-colors` — View and change the list of color roles used for `/colors`
- `/manage-privileges` — View and change the list of roles with the permissions
to use this bot's privileged commands.
- `/prune` — Delete a selected number of recent messages.
- `/wiki` — Search for a page on the Okami Speedrunning wiki by title.


# Scopes
This bot needs the following OAuth2 Scopes (see the URL generator in the OAuth2
section of this Bot's application page):
- application.commands: In order to register and respond to slash commands
- bot: For bot permissions

# Bot Permissions
This bot needs the following Bot Permissions:
- Send Messages: Used mainly for the /embed-message command and
routines/appointments
- Manage Messages: For the /prune command
- Embed Links: Technically optional, but desired for the /embed-message and
/wiki commands
- Manage Roles: For the /colors command

# Bot Role
Please note that the Autoride Bot Role should be ranked higher than all color
roles in your guild's role hierarchy. Otherwise, it will not be able to add or
remove higher-ranked color roles when using the `/colors` command.

Additionally, the Bot Role should have the "View Messages" channel permission in
any channel from which you use the `/embed-messages` command, and the "Send
Messages" channel permission in any channel to which you direct the embeded
message to be sent.

# Features I have imagined:
- Welcome message for potential new runners.
- Simple polls
- Reminders, anywhere from minute to months.
- Wiki integration:
    - Automatic page backups via Archive.org api?
- Twitch integration:
    - Automatically delete posts in #streams when users are no longer streaming.
    - Try to detect when runners are streaming Okami and automatically post in #streams, or maybe DM those users to post themselves?
    - Automatically post clips?
- Leaderboard integration:
    - Automatically make a post in #announcements when a new WR is verified.
    - Command to retrieve WR time and 110% threshold for elevated verification requirements.
    - Commands for game/category rules.
    - Automatically make a post in #announcements when a change is made to game rules.
    - Automatically make a post in the associated channel when a change is made in a category's rules.
- OkamiMaps Integration:
    - Command for finding items on maps, like /maps type=items map=shinshu name=crystal, which would give you a link to the okamimaps items table with some search parameters. The site would handle the actual searching itself, client-side.
    - Maybe automatically posting map or item images when there is only one result? This might require some image generation, which may not be feasible on Rasperry Pi 3b.
- Data commands:
    - Item value
    - Enemy health
- Auride says (random)
- Abbreviation finder / explainer (Maybe via wiki page?)
- "On This Day" anniversary/history trivia routine.