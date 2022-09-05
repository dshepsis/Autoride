# Description
Appointments are actions/events that will occur at some point in the future.
Each one has an associated handler, referencing a module stored stored in this
`appointmentHandlers` folder. Each handler module has an `execute` method, which
receives the Discord.js `client` object, in order to send messages based on its
results. Each one also receives a `data` object contained within the
`appointment`.