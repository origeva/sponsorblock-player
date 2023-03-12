import { AudioResource, createAudioResource, demuxProbe } from '@discordjs/voice'
import { Readable } from 'stream'
import { ContainerType, trimSegmentsAudio } from './audioUtil'
import { getStream } from './stream/yt-dlp'
import { Segment } from 'sponsorblock-api'

export type StreamOptions = { seek?: number; skipSegments?: Segment[]; container: ContainerType }

/**
 * This is the data required to create a Track object
 */
export interface TrackData {
	channelId: string
	channelTitle: string
	id: string
	title: string
	url: string
	/**
	 * Length of the track in seconds
	 */
	length: number
	segments: Segment[]
}

/**
 * A Track represents information about a YouTube video (in this context) that can be added to a queue.
 * It contains the title and URL of the video, as well as functions onStart, onFinish, onError, that act
 * as callbacks that are triggered at certain points during the track's lifecycle.
 *
 * Rather than creating an AudioResource for each video immediately and then keeping those in a queue,
 * we use tracks as they don't pre-emptively load the videos. Instead, once a Track is taken from the
 * queue, it is converted into an AudioResource just in time for playback.
 */
export class Track implements TrackData {
	public readonly channelId: string
	public readonly channelTitle: string
	public readonly id: string
	public readonly title: string
	public readonly url: string
	public currentLength: number
	public readonly length: number
	public readonly segments: Segment[] = []
	// public readonly onStart: () => void
	// public readonly onFinish: () => void
	// public readonly onError: (error: Error) => void

	public constructor(trackData: TrackData) {
		this.channelId = trackData.channelId // ??
		this.channelTitle = trackData.channelTitle
		this.id = trackData.id
		this.title = trackData.title
		this.url = trackData.url
		this.length = trackData.length
		this.currentLength = this.length
		this.segments = trackData.segments
	}

	/**
	 * Creates an AudioResource from this Track.
	 */
	public async createAudioResource(options?: StreamOptions): Promise<AudioResource<Track>> {
		let probe = await demuxProbe(this.createAudioStream(options))
		return createAudioResource(probe.stream, { metadata: this, inputType: probe.type, inlineVolume: true })
	}

	/**
	 * Creates a Readable audio stream from this Track.
	 */
	public createAudioStream(options?: StreamOptions): Readable {
		let stream = getStream(this.id)
		if (options) {
			let neededSegments: Segment[] | { startTime: number; endTime: number }[] = options.skipSegments || []
			if (options.seek) {
				let seek = options.seek
				let endTime = neededSegments.find((segment) => segment.startTime < seek && segment.endTime > seek)?.endTime
				neededSegments = neededSegments.filter((segment) => segment.startTime > seek)
				endTime = endTime ?? options.seek
				neededSegments = [{ startTime: 0, endTime }, ...neededSegments]
			}
			if (neededSegments.length) {
				stream = stream.pipe(trimSegmentsAudio(neededSegments, options.container))
			}
		}
		return stream
	}

	/**
	 * Creates a Track from a video URL.
	 *
	 * @param url The URL of the video
	 * @returns The created Track
	 */
	// public static async from({ channelId, channelTitle, id, title, url, length, segments }: TrackData): Promise<Track> {
	// 	// let { video_url, videoId, title, lengthSeconds } = (await getInfo(url)).videoDetails
	// 	// url = video_url
	// 	// let length = parseFloat(lengthSeconds)
	// 	// length -= segments.map((segment) => segment.endTime - segment.startTime).reduce((previousValue, currentValue) => previousValue + currentValue)
	// 	// let segments: Segment[] | undefined
	// 	// try {
	// 	// 	segments = await sponsorBlock.getSegments(videoId, allCategories)
	// 	// } catch (err) {}
	// 	// if (!segments) segments = []
	// 	return new Track({
	// 		channelId,
	// 		channelTitle,
	// 		id,
	// 		title,
	// 		url,
	// 		length: Math.floor(length),
	// 		segments,
	// 	})
	// }
}
