import fs, { readFileSync } from 'fs'
import { Category } from 'sponsorblock-api'
import axios from 'axios'
import { program } from 'commander'
import { logger } from './logger'

export type StationInfo = { name: string, siteUrl: string, streamUrl: string }

export const allCategories: Category[] = ['interaction', 'intro', 'music_offtopic', 'outro', 'preview', 'selfpromo', 'sponsor']
// export const allStations: string[] = ['hive365']

export let stations: StationInfo[]

export const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.APPLICATION_ID}&permissions=3162112&redirect_uri=https%3A%2F%2Fgithub.com%2Forigeva%2F&scope=bot%20applications.commands`

export let permitted: Record<string, string>

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

program.name('music-player')
.option('--config <location>', 'Config location', './config.json')
.action(({ config }) => {
	try {
		let configObj: { stations: StationInfo[], permitted: Record<string, string> } = JSON.parse(readFileSync(config).toString())
		stations = configObj.stations
		permitted = configObj.permitted
	} catch (err) {
		if (err.code === 'ENOENT') {
			logger.error(`Config was not found in specified location ("${config}")`)
			return
		}
	}
})
program.parse()

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
