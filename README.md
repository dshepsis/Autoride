# Autoride
Discord JS Bot designed for the Okami Speedrunning Discord.

https://github.com/dshepsis/Autoride

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

# How to set up a Raspberry Pi for Autoride
1. Acquire these items:
    - Raspberry Pi or other low-power Linux computer suitable for 24/7 uptime. I use a 3B. You can get one used for $20-30 USD and it will consume about $5 worth of electricity per year. 
    - Power supply for the above
    - Internet connection accessible to the above, e.g. a short ethernet cable going directly to your router
    - SD Card (Should probably be at least 4 GB, I use 16 GB) or other bootable drive
    - A computer capable of formatting the above
    - A computer that will be connected to the same internet network as the Pi (can be the same one)
    - Optionally, a smart plug/power outlet/socket allowing you to remotely power cycle the Pi if it becomes unresponsive while you're away
2. Format the boot medium for the Pi.
    - You can use https://www.raspberrypi.com/software/ to do so with an SD card.
    - If you can, set a username, hostname, and password at this time. Make sure the password is very strong to protect your Pi, bot, and your whole network from evil hackers. I suggest generating and storing the password in a password bank (e.g. KeePass) on the computer from which you will use SSH.
    - Make sure SSH is enabled by default.
    - Set the operating system to automatically log into the main user and into the CLI rather than the GUI.
    - If you are not able to change all these settings when creating the boot medium, do so locally the first time you turn on the Pi. You may need to temporarily connect it to a monitor, keyboard, and mouse.
3. Connect Pi to the router, insert the boot media (usually the above SD card), and connct to power (through the smart plug if using).
    - You do not need to connect it to a monitor or any other peripherals. If set up as described above, it should automatically log in and be open to an SSH connection, which is how we will do the rest of the configuration. This is basically a way of running command prompt/terminal commands on the Pi rmotely from another computer.
4. Wait for a few minutes, then from a computer connected to the same router/network, go to your router settings.
    - This will probably be accessed through your web browser using IP address `192.168.1.1` or `192.168.0.1`. Just paste those diretly into the URL bar.
    - You will need your router admin password. If it is set to a default value, take the time to set it now. You can also take the opportunity to change any other settings you like if you know what you're doing.
5. Look through the device list. Look for a device with a name matching the hostname you set above (or set by default, e.g. "pi").
6. Copy or note down that device's local IP address. It will be something like `192.168.0.159`.
7. If possible, set that IP address to be reserved for that device in the router settings.
8. Save and close the router settings.
9. Open `cmd`, `powershell` or other terminal from the same computer. Type `ssh pi@192.168.0.159`, substituting `pi` with your device's hostname (as shown in the router settings) and `192.168.0.159` with your Pi's local IP address.
    - If you change the SSH port (it's 22 by default) add `-p (port)` to the command, e.g. `ssh -p 2222 pi@192.168.0.159`.
10. Type in the Pi's password when prompted. Wait a minute or so to connect.
11. You may be prompted to create a `.ssh/known_hosts` file or add the required lines to it.
    - If you already have a `known_hosts` file, you can rename it to `known_hosts.old` or similar and then allow the SSH to create a new one, then copy over any necessary lines from the old one.
12. Once connected, your terminal line should now start with `pi@pi:~ $` or similar, indicating you're logged into the pi as the main user.
    - If you are not able to log in, check that you have the right IP, hostname, password, and port.
    - If you lost the password at some point, you may need to reset it from the Pi or even reformat the boot drive.
13. Type `sudo apt upgrade`. This will update any packages included with your linux installation.
    - I don't believe it's required, but you may need to run `sudo apt update` first to retrieve the list of potential updates.
14. Type `sudo apt install nodejs`. This will install [Node.js](https://nodejs.org/), a JavaScript runtime environment which will run Autoride's source code. 
15. Type `sudo apt install npm`. This will install [NPM](https://www.npmjs.com/), a package manager for Node.js which is needed for PM2 (see below).
16. Type `wget -qO- https://get.pnpm.io/install.sh | sh -`. This will install [PNPM](https://pnpm.io/installation), a package manager for Node.js which we'll use to download and manage the dependencies for Autoride.
    - Technically, we can use NPM instead of PNPM for everything, but my preference is to use PNPM where possible for slightly improved performance.
17. Type `pnpm install pm2 -g`. This will install [PM2](https://pm2.keymetrics.io/), a process manager for Node.js, which we'll use to make sure that Autoride is automatically restarted if it crashes.
    - It will also store Autoride's debug output in log files which can be submitted in the Issues tab of this GitHub repository.
18. Type `pm2 startup`. This will output a command starting with `sudo env PATH=`. Copy the whole command, then paste it. This will add a startup script which will restart PM2 (and thus Autoride) automatically if the Pi shuts off and is turned back on.
    - This is needed to avoid having to manually restart Autoride if you lose power.
    - This will also allow you to restart Autoride by toggling the smart plug, if you're using one.
19. Optionally,  and then `pm2 install pm2-logrotate`. This will download a [module](https://github.com/keymetrics/pm2-logrotate) to make sure the debug logs are constrained to a specific size, which is useful if your SD card is unusually small.
    - NPM must be installed for this to work. PNPM will not work.
    - Optionally, type `pm2 set pm2-logrotate:max_size 1G` to set the max-size to 1 GB, or something like that, depending on how much free space you have on the Pi.
    - You can check how much free space you have by typing `df` and looking at the "available" column for the row where "Mounted on" is `/`. This value, divided by 1e6, is how many GB you have left at this point. I would use less than 1 quarter of this to be safe.
20. Type `git clone https://github.com/dshepsis/Autoride.git` (replace with the base URL of this repository if it's a fork). This will download Autoride's source code to the `/Autoride/` directory (folder).
21. Type `cd Autoride` to move the current working directory into the folder we just created with `git clone`.
22. Type `pnpm install` to install all of Autoride's dependencies. This may take a few minutes.
23. Before running Autoride, create the config file. Type `exit` to exit SSH.
24. Type `scp -P 2222 "pi@192.168.0.159:Autoride/example config.json" piConfig.json` to copy the example config to your local machine.
    - Replace the port, hostname, URL, etc. just like with `ssh`. Note that, if you specify the port, you must use `-P` rather than `-p` like with `ssh`.
    - This will ask for a password, also just like `ssh`.
    - Alternatively, you could create the config file directly on the Pi over SSH using an editor like `nano`. Whatever you prefer, so long as a valid `config.json` ends up in the `/Autoride/` directory.
25. Fill out the config.json file exactly as it describes. You'll need to create a Discord and Twitch bot token, among other things. Just follow the included instructions.
    - Some fields are optional if you don't intend to use the related features.
26. Type `scp piConfig.json -P 2222 "pi@192.168.0.159:Autoride/config.json"` to copy the back to the pi with the name `config.js`. This particular filename is required as the bot looks for it exactly.
27. SSH back into the Pi and `cd` back into the Autoride directory.
28. Type `cat config.js` to review the contents of the config file we sent over with `scp`. 
29. Type `pm2 start index.mjs -n Autoride` to start Autoride through PM2 as a task named "Autoride". You will need to refer to this name in future PM2 commands when managing it.
30. Type `pm2 logs` and monitor Autoride's debug output for a bit to make sure it's running properly.
    - Ideally, you'll see something like
      ```
      1|Autoride | Attempting to log in...
      1|Autoride | Success! Logged in.
      1|Autoride | Client ready as Autoride#1234. Setting up commands...
      1|Autoride | Finished setting up commands!
      1|Autoride | Running routine "monitorTwitchStreams"...
      ```
    - If it's outputting any obvious errors at this point, you'll want to type `pm2 stop Autoride` and then figure out the cause. It will most likely be a mistake you made filling out config.json. Once you're ready to try again, type `pm2 restart Autoride`.
31. Once you have your bot running and in good health, type `pm2 save` to ensure pm2 will restart it in the event of a power cycle.
32. Use `scp` or other means to regularly make backup copies of `config.js` and the `guild-config` directory. This is important as SD cards (and other drives) can fail without warning. However, be sure to NEVER share your Discord/Twitch/other tokens with anyone. Make sure any files which contain them are added to your `.gitignore` file in any git directory the backups are in. Otherwise, bots will instantly automatically find your tokens and steal them to maliciously impersonate your bot.
33. Use the `/manage-` commands in Discord to manually configure the bot.