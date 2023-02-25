import { AudioPlayerStatus } from '@discordjs/voice'
import { Collection, TextChannel } from 'discord.js'
import express from 'express'
import { SessionManager } from './SessionManager'
import { youtube } from './bot'
import { StreamOptions, Track } from './Track'
import { Server, createServer } from 'http'
import {} from 'passport'
import { logger } from './logger'

const sessionManager = SessionManager.getInstance()

const port = process.env.PORT || 80
const app = express()

type APISession = { guildId: string; currentTrack: Track | undefined; queue: Track[]; repeat: boolean; shuffle: boolean }

export const downloadIds = new Collection<string, { track: Track; options?: StreamOptions }>()

app.use(express.static('./resources/static'))

app.get('/', (req, res) => {
	res.send(`The site isn't ready just yet :(`)
})

app.get('/download/:downloadId', (req, res) => {
	let { track, options } = downloadIds.get(req.params.downloadId) || {}
	if (track) {
		// res.header(`Content-Disposition', 'attachment; filename="${track.title}"`)
		res.attachment(track.title + '.mp3')
		track.createAudioStream(options).pipe(res)
	} else {
		res.status(404).send('Download link is incorrect or has expired.')
	}
})

app.get('/download/:downloadId/webm', (req, res) => {
	let { track, options } = downloadIds.get(req.params.downloadId) || {}
	if (track) {
		// res.header(`Content-Disposition', 'attachment; filename="${track.title}"`)
		res.attachment(track.title + '.webm')
		track.createAudioStream(options).pipe(res)
	} else {
		res.status(404).send('Download link is incorrect or has expired.')
	}
})

app.get('/sessions', (req, res) => {
	res.json(
		sessionManager.sessions.map((session) => {
			return { guildId: session.guildId, currentTrack: session.currentTrack, repeat: session.repeat, shuffle: session.shuffle }
		})
	)
})

app.get('/sessions/:guildId', (req, res) => {
	let guildId = req.params.guildId
	let session = sessionManager.sessions.get(guildId)
	if (session) {
		res.json({ guildId, currentTrack: session.currentTrack, queue: session.queue, repeat: session.repeat ?? false })
	} else {
		res.status(404).json({ err: 'Session was not found.' })
	}
})

app.post('/sessions/:guildId/addtrack', async (req, res) => {
	let session = sessionManager.sessions.get(req.params.guildId)
	if (session) {
		let url = req.body.url
		let track = new Track((await youtube.getTracks(['']))[0])
		if (session.audioPlayer.state.status === AudioPlayerStatus.Playing) {
			session.addTrack(track)
		} else {
			session.play(track)
		}
		res.sendStatus(200)
	} else {
		res.status(404).json({ err: 'Session was not found.' })
	}
})

// app.post('/sessions/:guildId/say')

// Maintainance
// TODO update API keys on runtime

export let server: Server | undefined
export const startServer = (): Server => {
	server = createServer(app).listen(port, () => {
		logger.info(`Listening on port ${port}`)
	})
	return server
}

export const closeServer = (): boolean => {
	if (server) {
		server.close()
		server = undefined
		return true
	} else {
		return false
	}
}
