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
- `/prune` — Delete a selected number of recent messages.
- `/wiki` — Search for a page on the Okami Speedrunning wiki by title.
- `/twitch-post` — Have the bot post an embed containing data about a currently
live Twitch.tv stream, which can be automatically updated and then deleted when
the stream ends.
- `/manage-twitch` — Configure the bot's behavior with respect to automatically
monitoring and posting messages about Twitch streams, based on lists of followed
users and games, blocked users, and required keywords.
- `/is-twitch-highlight` — Gets information about a twitch.tv VOD based on its
  URL. This is useful for checking whether the video for a leaderboard
  submission is a highlight (permanently hosted) as opposed to a basic archived
  past-broadcast, which would be automatically deleted after a some time.
- `/manage-otd` — Configure the bot's on-this-day daily announcement feature.
  Each day, the bot will post a message with a list of notable events that
  occurred on the same day in past years. You can add, remove, and list out
  events. Announcements will be posted automatically each day to the configured
  channel if there are any such events, or you can manually post announcements
  from any date whenever you want.

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
- Embed Links: Required for the /twitch-post, /embed-message, and /wiki commands
commands and the monitorTwitchStreams routine.
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
- Leaderboard integration:
    - Automatically make a post in #announcements when a new WR is verified.
    - Command to retrieve WR time and 110% threshold for elevated verification
      requirements.
    - Commands for game/category rules.
    - Automatically make a post in #announcements when a change is made to game
      rules.
    - Automatically make a post in the associated channel when a change is made
      in a category's rules.
- OkamiMaps Integration:
    - Command for finding items on maps, like /maps type=items map=shinshu
      name=crystal, which would give you a link to the okamimaps items table
      with some search parameters. The site would handle the actual searching
      itself, client-side.
    - Maybe automatically posting map or item images when there is only one
      result? This might require some image generation, which may not be
      feasible on Rasperry Pi 3b.
- Data commands:
    - Item value
    - Enemy health
- Abbreviation finder / explainer (Maybe via wiki page?)