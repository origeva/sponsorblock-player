import { raw as ytdl } from 'youtube-dl-exec'
import { Readable } from 'stream'

export const getStream = (url: string): Readable => {
	let process = ytdl(
		url,
		{
			o: '-',
			q: '',
			f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
			r: '100K',
		},
		{ stdio: ['ignore', 'pipe', 'ignore'] }
	)
	if (!process.stdout) {
		throw new Error('youtube-dl.ts No process.stdout')
	}
	return process.stdout
}
