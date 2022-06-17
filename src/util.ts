import { Readable } from 'stream'
import { DateTime } from 'luxon'
import crypto from 'crypto'

export const generateRandomString = async (): Promise<string> => {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(6, (err, buf) => {
			if (err) {
				reject(err)
			} else {
				resolve(buf.toString('base64'))
			}
		})
	})
}

export const stringToTimeInSeconds = (duration: string): number => {
	let timestampRegex = /\b(?:(?:(?<h>\d{1,2}):)?(?:(?<m>[0-5]?\d):))?(?<s>[0-5]?\d)\b/
	let result = duration.match(timestampRegex)
	if (result && result[0] === duration && result.groups) {
		let seconds = 0
		if (result.groups.h) {
			seconds += Number.parseInt(result.groups.h) * 60 * 60
		}
		if (result.groups.m) {
			seconds += Number.parseInt(result.groups.m) * 60
		}
		if (result.groups.s) {
			seconds += Number.parseInt(result.groups.s)
		}
		return seconds
	}
	return -1
}

export const getTimeString = (): string => {
	return DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss.SSS')
	// let time = new Date()
	// return `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}]`
}

export const isURL = (url: string): boolean => {
	try {
		new URL(url)
	} catch (err) {
		return false
	}
	return true
}

export function streamToString(stream: Readable): Promise<string> {
	const chunks: Buffer[] = []
	return new Promise((resolve, reject) => {
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
		stream.on('error', (err) => reject(err))
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
	})
}
