import * as patterns from './schema-util/patterns.mjs';

export const name = 'onThisDay';



// Creates an AJV schema for a single month. This is used so we can map month
// names into a discrete, unique schema for each of the 12 months.
function monthSchema(monthName) {
	return {
		description: `An object representing a month, with a key for the month
		name and numeric keys for each day where a notable event occurred in
		some year.`,
		type: 'object',
		minProperties: 1,
		maxProperties: 32,
		additionalProperties: false,
		required: ['month'],
		properties: {
			'month': {
				type: 'string',
				const: monthName,
			}
		},
		patternProperties: {
			[patterns.dayOfMonth]: {
				description: `An object representing a day, with a key for each
				year where something notable happened on this day and month,
				and the value is an array of strings describing said events.`,
				type: 'object',
				minProperties: 1,
				additionalProperties: false,
				patternProperties: {
					"^\\d+": { //Keys are numbers (years)
						description: `An array of strings describing what
						happened on this month, day, and year.`,
						type: 'array',
						minItems: 1,
						items: {type: "string"}
					}
				}
			}
		},
	};
}

export const schema = {
	description: `An object containing some data about when/where announcements
	should be posted regarding notable events that occurred on this day in the
	past. These announcements will be posted every day through the postOTD.mjs
	routine.`,
	type: 'object',
	additionalProperties: false,
	required: ['events'],
	properties: {
		'otdChannel': {
			description: `The snowflake Id of the discord channel in which to
			post messages about notable events. Not required, but no streams
			will be reported unless a channel is set using the /manage-OTD
			command. This property is optional, but if it's ommitted, no
			announcements will be posted.`,
			type: 'string',
			pattern: patterns.snowflake,
		},
		'lastDayPosted': {
			description: `A human-readable date representing the last day that
			an announcement of notable past events was posted to the channel
			indicated by the otdChannel property. This should be formatted using
			\`Intl.DateTimeFormat('en-GB', {day: "2-digit", month: "long"})})\`.`,
			type: 'string',
			pattern: patterns.readableDate,
		},
		'events': {
			description: `An array of objects representing each month where notable
			events occurred in the past.`,
			type: 'array',
			minItems: 12,
			additionalItems: false, // No additional items other than these: vvv
			items: [
				"January",
				"February",
				"March",
				"April",
				"May",
				"June",
				"July",
				"August",
				"September",
				"October",
				"November",
				"December"
			].map(monthSchema)
		}
	}
};

/**
 * An object representing a day, with a key for each year where something
 * notable happened on this day and month, and the value is an array of strings
 * describing said events.
 * @typedef {{[year: string]: string[]}} DayObj
 */
/**
 * The name of a month
 * @typedef {"January"|"February"|"March"|"April"|"May"|"June"|"July"|"August"|"September"|"October"|"November"|"December"} monthName
 */
/**
 * An object representing a month, with a key for the month name and numeric
 * keys for each day where a notable event occurred in some year.
 * @typedef {{[day: string]: DayObj} & {month: monthName}} MonthObj
 */
/**
 * An object containing some data about when/where announcements should be
 * posted regarding notable events that occurred on the this day in the past.
 * These announcements will be posted every day through the postOTD.mjs
 * routine.
 * @typedef {object} OTDConfig
 * @prop {string} [otdChannel] The snowflake Id of the discord channel in
 * which to post messages about notable events. Not required, but no streams
 * will be reported unless a channel is set using the /manage-OTD command. This
 * property is optional, but if it's ommitted, no announcements will be posted.
 * @prop {string} [lastDayPosted] A human-readable date representing the last
 * day that an announcement of notable past events was posted to the channel
 * indicated by the otdChannel property. This should be formatted using
 * `Intl.DateTimeFormat('en-GB', {day: "2-digit", month: "long"})})`.
 * @prop {MonthObj[]} events An array of objects representing each month where
 * notable events occurred in the past.
 */

/**
 * @returns {OTDConfig} A value which matches the onThisDay scheme while being
 * as empty as possible.
 */
export function makeDefault() {
	return {
		events: [
			{
				month: "January"
			},
			{
				month: "February"
			},
			{
				month: "March"
			},
			{
				month: "April"
			},
			{
				month: "May"
			},
			{
				month: "June"
			},
			{
				month: "July"
			},
			{
				month: "August"
			},
			{
				month: "September"
			},
			{
				month: "October"
			},
			{
				month: "November"
			},
			{
				month: "December"
			}
		]
	};
}

/** @type {OTDConfig} */
export const example = {
	'otdChannel': '123456789123456789',
	'lastDayPosted': "01 January",
	'events': [
		{
			'16': {
				'2023': [
					"Legoerofeggos performed [NG Any%](https://youtu.be/a26nEKGWFaM) on GDQ Hotfix - She is Speed."
				]
			},
			'30': {
				'2016': [
					"Kinnin11 performed [NG+ All Brushes](https://youtu.be/eANmtRj91to) at Pre-ESA 2016."
				]
			},
			month: "January"
		},
		{
			month: "February"
		},
		{
			month: "March"
		},
		{
			month: "April"
		},
		{
			month: "May"
		},
		{
			month: "June"
		},
		{
			month: "July"
		},
		{
			'12': {
				'2019': [
					"Kinnin11 performed [NG+ Any%](https://youtu.be/Vq9HSzvsUds) at [BSG Annual 2019](https://horaro.org/bsgmarathon/annual2019)."
				],
				'2022': [
					"Legoerofeggos performed [NG Any%](https://youtu.be/toA_jkNI_Lo) at [ARPGME 2022](https://oengus.io/en/marathon/arpgme2022)."
				]
			},
			month: "August"
		},
		{
			month: "September"
		},
		{
			month: "October"
		},
		{
			month: "November"
		},
		{
			month: "December",
			'10': {
				"2020": [
					"Auride discovered [Sneeze Skip](https://okami.speedruns.wiki/Sneeze_Skip).",
					"Auride discovered [Double Skip](https://okami.speedruns.wiki/Double_Skip)."
				]
			}
		}
	]
};