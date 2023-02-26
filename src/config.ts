import fs from 'fs'
import { Category } from 'sponsorblock-api'
import axios from 'axios'
import { logger } from './logger'

export const allCategories: Category[] = ['interaction', 'intro', 'music_offtopic', 'outro', 'preview', 'selfpromo', 'sponsor']
// export const allStations: string[] = ['hive365']

export const stations: { [key: string]: string } = {
	Hive365: 'http://stream.hive365.co.uk:8088/live',
	Eco99FM: 'https://eco-live.mediacast.co.il/99fm_aac',
}

export const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.APPLICATION_ID}&permissions=3162112&redirect_uri=https%3A%2F%2Fgithub.com%2Forigeva%2F&scope=bot%20applications.commands`

export const permitted: { [key: string]: string } = {
	PHOENIX_ID: '298586845351116801',
	ORI_ID: '188415501607632896',
}

const domain = process.env.DOMAIN
export let serverHostname = domain
export const serverProtocol = 'http://'
if (!serverHostname) {
	axios.get('https://myexternalip.com/raw/').then((res) => {
		exports.serverHostname = res.data
	})
}

export let kaomojis: string[]
fs.readFile('./resources/kaomoji.txt', (err, data) => {
	if (err) throw err
	kaomojis = data.toString().split('\n').map((line) => line.trim()).filter((line) => line)
})

class ConfigManager {
	private static instance: ConfigManager

	public inviteUrl = process.env.INVITE_URL

	private constructor() {
		if (!this.inviteUrl) {
			// logger.child({ requestId: '451' }).warn('Invite URL was not defined')
		}
	}

	public static getInstance(): ConfigManager {
		return new ConfigManager()
	}
}
