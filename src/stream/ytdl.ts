import ytdl from 'ytdl-core'
import { Readable } from 'stream'

export const getStream = (url: string): Readable => {
	return ytdl(url, {
		quality: 'highestaudio',
		filter: (format) => {
			return format.container === 'webm'
		},
	})
}
