# Autoride
Discord JS Bot

# Features I have imagined:
- Feature parity with MEE6 as it's currently used in the Okami Speedrunning Discord
    - Embed messages (like used in #resources)
    - Color and bingo roles via command (and reactions as well?)
- Welcome message for potential new runners.
- Wiki integration:
    - Improve the wiki command (auto-capitalization and no extra underscores).
    - Notifications in the #wiki-editor-chat channel when pages are edited/created/deleted.
    - Automatic page backups?
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