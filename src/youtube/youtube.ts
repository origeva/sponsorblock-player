import { Collection } from 'discord.js'
import axios from 'axios'
import { Segment, SponsorBlock } from 'sponsorblock-api'
import { allCategories } from '../config'
import { TrackData } from '../Track'
import { PlaylistData } from '../Playlist'
import { isURL } from '../util'
import ytdl from 'ytdl-core'
import { DateTime, Duration } from 'luxon'
import { logger } from '../logger'

class SearchResult<T> {
	public readonly time: DateTime = DateTime.now()
	public readonly data: T
	constructor(data: T) {
		this.data = data
	}
}
export const sponsorBlock = new SponsorBlock('test', { userAgent: 'discord-player' })

export default class YouTube {
	public youtubeVideoSearchCache = new Collection<string, string>() // <query, videoId>
	public youtubePlaylistSearchCache = new Collection<string, SearchResult<string>>() // <query, SearchResult<playlistId>>
	public youtubeVideoDataCache = new Collection<string, SearchResult<TrackData>>() // <videoId, SearchResult<TrackData>>
	public youtubePlaylistCache = new Collection<string, SearchResult<PlaylistData>>() // <playlistId, SearchResult<Playlist>>
	constructor(public apiToken?: string) {
		this.apiToken = apiToken || process.env.YOUTUBE_API_TOKEN
		if (!this.apiToken) {
			throw new Error('No YouTube API token!')
		}
	}

	public async search(query: string): Promise<string | undefined> {
		query = query.toLowerCase()
		let id = this.youtubeVideoSearchCache.get(query)
		if (!id) {
			let response = await axios.get<any>(
				encodeURI(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&eventType=none&safeSearch=none&type=video&maxResults=1&q=${query}&key=${this.apiToken}`)
			)
			id = response.data.items[0]?.id.videoId
			if (id) {
				this.youtubeVideoSearchCache.set(query, id)
			}
		}
		return id
	}

	public async getTracks(videoIds: string[]): Promise<TrackData[]> {
		let tracks: (TrackData | undefined)[] = []
		videoIds = videoIds.filter((videoId) => {
			let result = this.youtubeVideoDataCache.get(videoId)
			if (result) {
				tracks.push(result.data)
				return false
			} else {
				tracks.push(undefined)
				return true
			}
		})
		if (videoIds.length) {
			let idParams = `&id=` + videoIds.join('&id=')
			let response = await axios.get<any>(`https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails%2Cid${idParams}&key=${this.apiToken}`)
			let videoItems = response.data.items as any[]
			let fetchedTracks = await Promise.all(
				videoItems.map(async (item) => {
					let segments: Segment[] = []
					try {
						segments = await sponsorBlock.getSegments(item.id, allCategories)
					} catch (err) {
						if (err.status === 403 || err.status === 429) {
							logger.log(err)
						}
					}
					let { channelId, channelTitle, title } = item.snippet
					let trackData: TrackData = {
						channelId,
						channelTitle,
						id: item.id,
						title,
						url: `https://www.youtube.com/watch?v=${item.id}`,
						length: Duration.fromISO(item.contentDetails.duration).toMillis() / 1000,
						segments,
					}
					this.youtubeVideoDataCache.set(item.id, new SearchResult(trackData))
					return trackData
				})
			)
			fetchedTracks.forEach((track) => {
				tracks[tracks.findIndex((val) => val === undefined)] = track
			})
		}
		return tracks as TrackData[]
	}

	public async getPlaylist(id: string): Promise<PlaylistData | undefined> {
		let result = this.youtubePlaylistCache.get(id)
		let playlist = result?.data
		if (!playlist) {
			let playlistResponse = await axios.get<any>(encodeURI(`https://youtube.googleapis.com/youtube/v3/playlists?part=snippet&part=id&id=${id}&key=${this.apiToken}`))
			let item = playlistResponse.data.items[0]
			if (item) {
				let playlistTitle = item.snippet.title
				let channelId = item.snippet.channelId
				let channelTitle = item.snippet.channelTitle

				let tracks: Promise<TrackData[]>[] = []
				let ids: string[] = []
				let nextPageToken = ''
				do {
					let playlistItemsResponse = await axios.get<any>(
						encodeURI(
							`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${id}&key=${this.apiToken}` +
								`${nextPageToken && `&pageToken=${nextPageToken}`}`
						)
					)
					nextPageToken = playlistItemsResponse.data.nextPageToken
					let items = playlistItemsResponse.data.items as any[]
					ids = items.map((item) => item.contentDetails.videoId as string)
					tracks = tracks.concat(this.getTracks(ids))
				} while (nextPageToken)

				playlist = { channelId, channelTitle, playlistId: id, playlistTitle: playlistTitle, tracks: (await Promise.all(tracks)).reduce((prev, current) => prev.concat(current)) }
				this.youtubePlaylistCache.set(id, new SearchResult(playlist))
			}
		}
		return playlist
	}

	public async searchPlaylist(query: string): Promise<string | undefined> {
		query = query.toLowerCase()
		let result = this.youtubePlaylistSearchCache.get(query)
		let id: string | undefined
		if (result && result.time.diffNow('hours').as('hours') < 12) {
			id = result.data
		} else {
			let response = await axios.get<any>(
				encodeURI(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&eventType=none&safeSearch=none&type=playlist&q=${query}&key=${this.apiToken}`)
			)
			let items = response.data.items as any[]
			id = items[0]?.id.videoId
			if (id) {
				this.youtubePlaylistSearchCache.set(query, new SearchResult(id))
			}
		}
		return id
	}

	public static isPlaylistURL(url: string): boolean {
		try {
			let urlObject = new URL(url)
			return isURL(url) && urlObject.hostname.includes('youtube.com') && urlObject.searchParams.get('list') ? true : false
		} catch (err) {
			return false
		}
	}

	public static extractPlaylistID(url: string): string {
		if (this.isPlaylistURL(url)) {
			return new URL(url).searchParams.get('list') as string
		}
		throw new Error('Youtube.extractPlaylistID: ' + url)
	}

	public static extractVideoID(url: string): string {
		return ytdl.getVideoID(url)
	}
}

// export default class YouTube {
// 	public youtubeVideoCache = new Collection<string, string>() // <query, videoId>
// 	public youtubePlaylistCache = new Collection<string, Playlist>()

// 	public async search(query: string): Promise<string | undefined> {
// 		return
// 	}

// 	static isPlaylistURL(url: string): boolean {
// 		let urlObject = new URL(url)
// 		let id = urlObject.searchParams.get('list')
// 		return isURL(url) && urlObject.hostname.includes('youtube.com') && urlObject.searchParams.get('list') ? true : false
// 	}

// 	static getPlaylistID(url: string): string {
// 		if (this.isPlaylistURL(url)) {
// 			return new URL(url).searchParams.get('list') as string
// 		}
// 		throw new Error('Youtube.getPlaylistID: ' + url)
// 	}
// }
