import { Collection } from 'discord.js'
import SpotifyWebApi from 'spotify-web-api-node'
import { logger } from './logger'
import { isURL } from './util'

// const spotify = new SpotifyWebApi({
// 	clientId: process.env.SPOTIFY_CLIENT_ID,
// 	clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
// 	redirectUri: 'https://github.com/origeva',
// })

export default class Spotify extends SpotifyWebApi {
	public spotifyIdCache = new Collection<string, string>()
	private consecutiveGrantError = 0
	private accessGranted = false
	private refreshTimer: NodeJS.Timer

	constructor(public credentials?: { clientId?: string; clientSecret?: string; redirectUri?: string }) {
		super({
			clientId: credentials?.clientId || process.env.SPOTIFY_CLIENT_ID,
			clientSecret: credentials?.clientSecret || process.env.SPOTIFY_CLIENT_SECRET,
			redirectUri: credentials?.redirectUri || process.env.SPOTIFY_REDIRECT_URI,
		})
		if (!this.getCredentials().clientId || !this.getCredentials().clientSecret) {
			throw new Error('Missing Spotify credentials!')
		}
		this.refresh()
	}

	private async refresh() {
		try {
			let response = await this.clientCredentialsGrant()
			this.setAccessToken(response.body.access_token)
			this.accessGranted = true
			this.consecutiveGrantError = 0
			clearTimeout(this.refreshTimer)
			this.refreshTimer = setTimeout(this.refresh.bind(this), (response.body.expires_in - 10) * 1000).unref() // expires_in value is in seconds, refresh token 10 seconds before expiration
		} catch (err) {
			if (++this.consecutiveGrantError > 3) {
				logger.error('Spotify failed: ' + err?.message)
				this.consecutiveGrantError = 0
			} else {
				logger.warn('Spotify Error: ' + err?.message)
				this.accessGranted = false
				this.refresh()
			}
		}
	}

	public static isSpotifyURL(url: string) {
		return isURL(url) && new URL(url).hostname === 'open.spotify.com'
	}

	public static urlResourceType(url: string): SpotifyResourceType | null {
		if (this.isSpotifyURL(url)) {
			return new URL(url).pathname.split('/')[1] as SpotifyResourceType
		} else {
			return null
		}
	}
	/**
	 *
	 * @param trackUrl
	 * @returns The given URL's "Artist - Track Name"
	 * @throws In case of an invalid url / id
	 */
	public async getTrackName(trackUrl: string): Promise<string> {
		let trackId = Spotify.getTrackId(trackUrl)
		let name = this.spotifyIdCache.get(trackId)
		if (!name) {
			if (!this.accessGranted) {
				await this.refresh()
			}
			try {
				let track = await this.getTrack(trackId)
				name = `${track.body.artists[0].name} - ${track.body.name}`
				this.spotifyIdCache.set(trackId, name)
			} catch (err) {
				throw new Error('Invalid track ID.')
			}
		}
		return name
	}

	public static getTrackId(trackUrl: string): string {
		let url = new URL(trackUrl)
		return url.pathname.split('/')[2]
	}
}

type SpotifyResourceType = 'track' | 'album' | 'artist' | 'playlist'
