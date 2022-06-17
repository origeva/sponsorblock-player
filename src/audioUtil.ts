import cp from 'child_process'
import ffmpeg from 'ffmpeg-static'
import { Segment } from 'sponsorblock-api'
import { Readable } from 'stream'

export type ContainerType = 'webm' | 'opus' | 'mp3'

export function trimSegmentsAudio(input: Readable, segments: (Segment | { startTime: number; endTime: number })[], container: ContainerType): Readable {
	if (!segments.length) {
		return input
	}
	let filter = ''
	if (segments) {
		let pos = 0
		for (let i = 0; i < segments.length; i++) {
			filter += `[0:a]atrim=start=${pos}:end=${segments[i].startTime},asetpts=PTS-STARTPTS[pt${i}];`
			pos = segments[i].endTime
		}
		filter += `[0:a]atrim=start=${pos},asetpts=PTS-STARTPTS[pt${segments.length}];`
		for (let i = 0; i < segments.length + 1; i++) {
			filter += `[pt${i}]`
		}
		filter += `concat=n=${segments.length + 1}:v=0:a=1`
	}
	// Start the ffmpeg child process
	const ffmpegProcess = cp.spawn(
		ffmpeg,
		[
			// Remove ffmpeg's console spamming
			'-loglevel',
			'8',
			'-hide_banner',
			// Audio input
			'-i',
			// stdin
			'pipe:0',
			// Filter Complex
			'-filter_complex',
			filter,
			// Define output container
			'-f',
			container,
			// stdout
			'pipe:1',
		],
		{
			stdio: [input, 'pipe', 'ignore'],
		}
	)

	// Link streams
	// input.pipe(ffmpegProcess.stdin)
	let output = ffmpegProcess.stdout
	output.on('close', () => {
		ffmpegProcess.kill()
		input.destroy()
	})

	return output
}

export function seekAudio(input: Readable, seek: number = 0): Readable {
	let filter = ''
	filter += `[0:a]atrim=start=${0}:end=${seek},asetpts=PTS-STARTPTS[pt${0}];`
	// filter += `concat=n=${segments.length + 1}:v=0:a=1`
	// Start the ffmpeg child process
	const ffmpegProcess = cp.spawn(
		ffmpeg,
		[
			// Remove ffmpeg's console spamming
			'-loglevel',
			'8',
			'-hide_banner',
			// Audio input
			'-i',
			// stdin
			'pipe:0',
			// Filter Complex
			'-filter_complex',
			filter,
			// Define output container
			'-f',
			'webm',
			// stdout
			'pipe:1',
		],
		{
			stdio: [input, 'pipe', 'ignore'],
		}
	)

	// Link streams
	// input.pipe(ffmpegProcess.stdin)
	let output = ffmpegProcess.stdout
	output.on('close', () => {
		ffmpegProcess.kill()
		input.destroy()
	})
	return output
}

export function convertToMP3(input: Readable): Readable {
	// Start the ffmpeg child process
	const ffmpegProcess = cp.spawn(
		ffmpeg,
		[
			// Remove ffmpeg's console spamming
			'-loglevel',
			'8',
			'-hide_banner',
			// Audio input
			'-i',
			// stdin
			'pipe:0',
			// Define output container
			'-f',
			'mp3',
			// stdout
			'pipe:1',
		],
		{
			stdio: [input, 'pipe', 'ignore'],
		}
	)

	// Link streams
	// input.pipe(ffmpegProcess.stdin)
	let output = ffmpegProcess.stdout
	output.on('close', () => {
		ffmpegProcess.kill()
		input.destroy()
	})
	return output
}
