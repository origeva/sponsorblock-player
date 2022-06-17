import winston, { createLogger, format, transports } from 'winston'
import { getTimeString } from './util'
import fs from 'fs'

winston.addColors({ debug: 'green', info: 'blue', warn: 'yellow', error: 'red' })

export const logger = createLogger({
	level: process.env.LOG_LEVEL || 'info',
	transports: [
		// new transports.Stream({
		// 	stream: fs.createWriteStream('logs.txt', { flags: 'a' }),
		// 	format: format.printf(({ level, message }) => `{"timestamp":"${getTimeString()}","level":"${level}","message":"${message}"}`),
		// }),
		new transports.Stream({
			stream: process.stdout,
			format: format.combine(
				format.colorize(),
				format.printf(({ level, message }) => `[${getTimeString()}] ${level}: ${message}`)
			),
		}),
	],
})
