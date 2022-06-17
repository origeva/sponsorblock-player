import { Track, TrackData } from './Track'

// export type Playlist = { channelId: string; channelTitle: string; playlistId: string; playlistTitle: string; tracks: Track[] }

export interface PlaylistData {
	channelId: string
	channelTitle: string
	playlistId: string
	playlistTitle: string
	tracks: TrackData[]
}

export class Playlist implements PlaylistData {
	public readonly channelId: string
	public readonly channelTitle: string
	public readonly playlistId: string
	public readonly playlistTitle: string
	public tracks: Track[]

	constructor(playlistData: PlaylistData) {
		this.channelId = playlistData.channelId
		this.channelTitle = playlistData.channelTitle
		this.playlistId = playlistData.playlistId
		this.playlistTitle = playlistData.playlistTitle
		this.tracks = playlistData.tracks.map((trackData) => new Track(trackData))
	}
}
