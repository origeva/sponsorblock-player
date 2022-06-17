import { spawn } from 'child_process'
import { Readable } from 'stream'

const ytdlpPath = process.env.YTDLP as string

export function getStream(id: string): Readable {
	let ytProcess = spawn(ytdlpPath, [id, '-f', 'bestaudio[ext=webm]', '-o', '-'], {
		stdio: ['ignore', 'pipe', 'ignore'],
	})
	return ytProcess.stdout
}
