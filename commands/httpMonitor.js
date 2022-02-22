// @TODO implement http-monitor command
// the /http-monitor re-enable command will have a 'scope' argument, which will
// determine which URLs get re-enabled. Possibilities will be:
// * ALL - Re-enables all URLs for this server
// * THIS CHANNEL - Re-enables all URLs which are reported in the interaction's
//   channel
// * MINE - Re-enables all URLs which are reported to the interaction's user
// * SINGLE URL - Re-enables a specific URL given in another argument
//   (how do we prevent multiple urlObjs from having the same actual URL?)