import { AudioPlayer, AudioResource, createAudioPlayer, CreateAudioPlayerOptions, createAudioResource, demuxProbe, PlayerSubscription } from '@discordjs/voice'
import axios from 'axios'
import { stations } from '../config'
import { logger } from '../logger'
import { Readable } from 'stream'

export class RadioManager {
	private static instance: RadioManager
	private radioStations: Map<string, RadioStation> = new Map<string, RadioStation>()
	private constructor() {}

	public static getInstance(): RadioManager {
		return this.instance || (this.instance = new RadioManager())
	}

	public async getRadioStation(stationName: string): Promise<RadioStation> {
		let station = this.radioStations.get(stationName)
		let url = stations[stationName]
		if (!station) {
			let res = await axios.get<Readable>(url, {
				responseType: 'stream',
			})
			// logger.debug(
			// 	Object.entries(res.headers)
			// 		.map(([key, val]) => `${key}: ${val}`)
			// 		.join('\n')
			// )
			let stream = res.data
			let probe = await demuxProbe(stream)
			let audioResource = createAudioResource(probe.stream, { metadata: this, inputType: probe.type })
			station = new RadioStation(stationName, url, audioResource, res.headers['icy-url'])
			logger.debug(`${stationName} was created`)
			this.radioStations.set(stationName, station)
		}
		return station
	}

	public deleteRadioStation(radioStation: RadioStation): void {
		radioStation.removeSubscriptions()
		radioStation.stop()
		this.radioStations.delete(radioStation.stationName)
		logger.debug(`${radioStation.stationName} deleted from map`)
	}
}

export class RadioStation extends AudioPlayer {
	public readonly stationName: string
	private playerSubscriptions: Set<PlayerSubscription> = new Set<PlayerSubscription>()
	public readonly url: string
	public readonly siteUrl: string
	private timeoutTime: number = 10 * 1000
	private timeout: NodeJS.Timeout

	constructor(stationName: string, url: string, audioResource: AudioResource, siteUrl: string, options?: CreateAudioPlayerOptions) {
		super(options)
		this.stationName = stationName
		this.url = url
		this.play(audioResource)
		this.siteUrl = siteUrl
		this.on('subscribe', (subscription) => {
			this.playerSubscriptions.add(subscription)
			this.clearTimeout()
		})
		this.on('unsubscribe', (subscription) => {
			this.playerSubscriptions.delete(subscription)
		})
		this.on('unsubscribe', () => {
			if (this.playerSubscriptionCount === 0) {
				this.setTimeout()
			}
		})
	}

	get playerSubscriptionCount(): number {
		return this.playerSubscriptions.size
	}

	public removeSubscriptions(): void {
		this.playerSubscriptions.forEach((subscription) => subscription.unsubscribe())
	}

	private setTimeout(): void {
		this.clearTimeout()
		this.timeout = setTimeout(() => {
			RadioManager.getInstance().deleteRadioStation(this)
		}, this.timeoutTime).unref()
	}

	private clearTimeout(): void {
		clearTimeout(this.timeout)
	}
}

// export async function getRadioStream() {
// 	logger.debug('Entered function')
// 	let res = await axios.get<Readable>('http://stream.hive365.co.uk:8088/live', {
// 		responseType: 'stream',
// 	})
// 	logger.debug('After call')
// 	res.data.pipe(fs.createWriteStream('radiotest.mkv'))
// 	logger.debug(res.status)
// }

// fetch('http://stream.hive365.co.uk:8088/live', {
// 	headers: {
// 		accept: '*/*',
// 		'accept-language': 'en-US,en;q=0.9,he;q=0.8',
// 		range: 'bytes=0-',
// 		Referer: 'http://stream.hive365.co.uk:8088/live',
// 		'Referrer-Policy': 'strict-origin-when-cross-origin',
// 	},
// 	body: null,
// 	method: 'GET',
// })

// HTTP/1.0 200 OK
// Server: Icecast 2.4.3
// Date: Fri, 14 Jan 2022 20:32:41 GMT
// Content-Type: audio/mpeg
// Cache-Control: no-cache
// Expires: Mon, 26 Jul 1997 05:00:00 GMT
// Pragma: no-cache
// Access-Control-Allow-Origin: *
// icy-br:128
// ice-audio-info: ice-samplerate=44100;ice-bitrate=128;ice-channels=2
// icy-br:128
// icy-description:The Beekeeper :: Keepin' Ya Buzzin'
// icy-name:Hive365
// icy-pub:1
// icy-url:https://hive365.co.uk
