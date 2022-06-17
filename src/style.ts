import { bold, hyperlink, hideLinkEmbed as hide, quote, italic } from '@discordjs/builders'
import { TrackData } from './Track'

/**
 * Returns the track's title bolded and hyperlinked
 * @param track
 * @param hideLinkEmbed	false by default
 * @returns
 */
export const styleTrack = (track: TrackData, hideLinkEmbed: boolean = false): string => {
	return hyperlink(bold(track.title), hideLinkEmbed ? hide(track.url) : track.url)
}

export const styleUrl = (text: string, url: string, hideLinkEmbed: boolean = false): string => {
	return hyperlink(bold(text), hideLinkEmbed ? hide(url) : url)
}

export const styleStatus = (status: string): string => {
	return bold(status)
}

export const booleanToString = (boolean: boolean): string => {
	return boolean ? 'ON' : 'OFF'
}

export const secondsToString = (seconds: number): string => {
	// seconds = Number(seconds);
	let h = Math.floor(seconds / 3600)
	let m = Math.floor((seconds % 3600) / 60)
	let s = Math.floor((seconds % 3600) % 60)

	let string = ''
	if (h) {
		string += h + ':'
		if (m < 10) {
			string += '0'
		}
	}
	string += m + ':'
	if (s < 10) {
		string += '0'
	}
	string += s

	return string
}
