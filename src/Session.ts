import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, joinVoiceChannel, PlayerSubscription, VoiceConnection } from '@discordjs/voice'
import { StreamOptions, Track, TrackData } from './Track'
import { client } from './bot'
import { Category } from 'sponsorblock-api'
import { allCategories } from './config'
import { Client } from 'discord.js'
import { SessionManager } from './SessionManager'
import { RadioStation } from './stream/Radio'
import { logger } from './logger'

const networkStateChangeHandler = (oldNetworkState: any, newNetworkState: any) => {
	const newUdp = Reflect.get(newNetworkState, 'udp');
	clearInterval(newUdp?.keepAliveInterval);
}

export type Listener = { guildId: string; channelId: string }
export type PlayInfo = { track: Track; eta: number }

export class Session {
	public readonly guildId: string
	public audioPlayer: AudioPlayer
	public radioStation: RadioStation | null = null
	private playerSubscription: PlayerSubscription | undefined
	public listeningGuildIds: string[] = []
	public voiceChannelId: string
	private voiceConnection: VoiceConnection | undefined
	public sbEnabled: boolean = true
	public categories: Category[] = allCategories
	public repeat: boolean = false
	public shuffle: boolean = false
	public currentTrack: Track | undefined
	private currentResource: AudioResource<Track> | null = null
	private volume: number = 1
	public currentTrackEndDate: Date | undefined
	public queueTime: number = 0
	public queue: Track[] = []
	private timeoutTime: number = 5 * 60 * 1000
	private timeout: NodeJS.Timeout
	public playing: boolean = false

	constructor(guildId: string) {
		this.guildId = guildId
		let audioPlayer = createAudioPlayer()
		// audioPlayer.on('stateChange', (oldState, newState) => {
		// 	logger.debug                                                                                                             (`Transferred from ${oldState.status} to ${newState.status}`)
		// })
		audioPlayer.on('error', (err) => {
			logger.debug(err.message)
		})
		audioPlayer.on(AudioPlayerStatus.Playing, () => {
			this.clearTimeout()
		})
		audioPlayer.on(AudioPlayerStatus.Idle, async (oldState) => {
			this.playing = false
			if (oldState.status === AudioPlayerStatus.Playing) {
				if (!this.repeat) {
					if (this.shuffle) {
						let result = Math.floor(Math.random() * this.queue.length)
						this.currentTrack = this.queue.splice(result, 1)[0]
					} else {
						this.currentTrack = this.queue.shift()
					}
				}
				if (this.currentTrack) {
					this.queueTime -= this.currentTrack.currentLength
					this.play(this.currentTrack)
				} else {
					this.setTimeout()
				}
			}
		})
		this.audioPlayer = audioPlayer
	}

	// /**
	//  * Decides on what to play next and returns the track or starts a disconnect timeout if nothing to play found.
	//  */
	// public getNext(): Track {
	// 	if (!this.repeat) {
	// 		if (this.shuffle) {
	// 			let result = Math.floor(Math.random() * this.queue.length)
	// 			this.currentTrack = this.queue.splice(result, 1)[0]
	// 		} else {
	// 			this.currentTrack = this.queue.shift()
	// 		}
	// 	}
	// 	if (this.currentTrack) {
	// 		this.play(this.currentTrack)
	// 	} else {
	// 		this.stop()
	// 	}
	// }

	public async play(trackData: TrackData, seek?: number): Promise<void> {
		if (this.radioPlaying) {
			return
		}
		this.playing = true
		let track = new Track(trackData)
		let options: StreamOptions = { seek, container: 'opus' }
		if (this.sbEnabled && this.categories.length && track.segments.length) {
			let skipSegments = track.segments.filter((segment) => this.categories.includes(segment.category))
			track.currentLength -= skipSegments.map((segment) => segment.endTime - segment.startTime).reduce((prev, current) => prev + current)
			options.skipSegments = skipSegments
		}
		this.currentResource = await track.createAudioResource(options)
		this.currentResource.volume?.setVolume(this.volume)
		this.audioPlayer.play(this.currentResource)
		this.currentTrack = track
		this.currentTrackEndDate = new Date(new Date().getTime() + track.currentLength * 1000)
	}

	public get radioPlaying(): boolean {
		return this.radioStation !== null
	}

	public async playRadio(radioStation: RadioStation): Promise<void> {
		this.playing = true
		this.clearTimeout()
		if (this.radioStation?.stationName === radioStation.stationName) {
			return
		}
		this.radioStation = radioStation
		if (this.playerSubscription) {
			let connection = this.playerSubscription.connection
			this.playerSubscription.unsubscribe()
			// connection.receiver.subscribe(userId)
			this.playerSubscription = connection.subscribe(radioStation)
		}
	}

	public stopRadio(): void {
		if (this.radioStation && this.playerSubscription) {
			this.setTimeout()
			this.playing = false
			this.radioStation = null
			let connection = this.playerSubscription.connection
			this.playerSubscription.unsubscribe()
			this.playerSubscription = connection.subscribe(this.audioPlayer)
		}
	}

	public setVolume(level: number) {
		this.volume = level
		this.currentResource?.volume?.setVolume(level)
	}

	public getVolume(): number {
		return this.volume
	}

	public async addTrack(trackData: TrackData, index?: number): Promise<PlayInfo> {
		if (!this.playing) {
			this.play(trackData)
			return { track: new Track(trackData), eta: 0 }
		}
		let track = new Track(trackData)
		if (this.sbEnabled && this.categories.length && track.segments.length) {
			let skipSegments = track.segments.filter((segment) => this.categories.includes(segment.category))
			track.currentLength -= skipSegments.map((segment) => segment.endTime - segment.startTime).reduce((prev, current) => prev + current)
		}
		this.queueTime += track.currentLength

		if (index !== undefined) {
			if (index < 0) {
				index = 0
			} else if (index >= this.queue.length) {
				index = this.queue.length
			}
			this.queue.splice(index, 0, track)
		} else {
			this.queue.push(track)
		}
		return { track, eta: this.queueTime }
	}

	// public async addPlaylist(playlistData: PlaylistData) {
	// 	let playlist = new Playlist(playlistData)

	// }

	public async skip(amount: number = 1) {
		for (let i = 0; i < amount; i++) {
			this.currentTrack = this.queue.shift()
		}
		if (this.currentTrack) {
			this.queueTime -= this.currentTrack.currentLength
			await this.play(this.currentTrack)
		} else {
			this.stop()
		}
	}

	public stop(): void {
		this.audioPlayer.stop()
		this.setTimeout()
	}

	public async joinVoiceChannel(listener: Listener): Promise<VoiceConnection> {
		logger.info('joined voice channel')
		this.setTimeout()
		let guild = await (client as Client<boolean>).guilds.fetch(listener.guildId)
		let adapterCreator = guild.voiceAdapterCreator
		this.voiceConnection = joinVoiceChannel({ channelId: listener.channelId, guildId: listener.guildId, adapterCreator, selfMute: false, selfDeaf: false })
		  
		this.voiceConnection.on('stateChange', (oldState, newState) => {
			const oldNetworking = Reflect.get(oldState, 'networking')
			const newNetworking = Reflect.get(newState, 'networking')
		  
			oldNetworking?.off('stateChange', networkStateChangeHandler)
			newNetworking?.on('stateChange', networkStateChangeHandler)
		})
		this.playerSubscription = this.voiceConnection.subscribe(this.audioPlayer)
		return this.voiceConnection
	}

	public toggleRepeat(): boolean {
		return (this.repeat = !this.repeat)
	}

	public toggleShuffle(): boolean {
		return (this.shuffle = !this.shuffle)
	}

	public toggleSponsorBlock(): boolean {
		this.sbEnabled = !this.sbEnabled
		this.updateTracksLength()
		return this.sbEnabled
	}

	public toggleCategory(category: Category): boolean {
		let index = this.categories.indexOf(category)
		if (index !== -1) {
			this.categories.splice(index, 1)
			this.updateTracksLength()
			return false
		} else {
			this.categories.push(category)
			this.updateTracksLength()
			return true
		}
	}

	private async updateTracksLength(): Promise<void> {
		if (this.queue.length) {
			if (this.sbEnabled && this.categories.length) {
				this.queue.forEach((track) => {
					track.currentLength = track.length
					if (track.segments.length) {
						let skipSegments = track.segments.filter((segment) => this.categories.includes(segment.category))
						track.currentLength -= skipSegments.map((segment) => segment.endTime - segment.startTime).reduce((prev, current) => prev + current)
					}
				})
			} else {
				this.queue.forEach((track) => {
					track.currentLength = track.length
				})
			}
			this.queueTime = this.queue.map((track) => track.currentLength).reduce((prev, current) => prev + current)
		}
	}

	public setTimeout(): void {
		this.clearTimeout()
		this.timeout = setTimeout(() => {
			this.playerSubscription?.unsubscribe()
			SessionManager.getInstance().deleteSession(this)
		}, this.timeoutTime).unref()
	}

	public clearTimeout(): void {
		clearTimeout(this.timeout)
	}
}
