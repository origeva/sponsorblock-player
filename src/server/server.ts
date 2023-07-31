import { AudioPlayerStatus } from '@discordjs/voice'
import { Collection } from 'discord.js'
import express, { NextFunction, Request, Response } from 'express'
import { SessionManager } from '../SessionManager'
import { youtube } from '../bot'
import { StreamOptions, Track } from '../Track'
import { Server, createServer } from 'http'
import {} from 'passport'
import { logger } from '../logger'
import { AuthenticationService } from './AuthenticationService'
import cors from 'cors'

const authenticationService = AuthenticationService.getInstance()
const sessionManager = SessionManager.getInstance()

const port = process.env.PORT || 80
const app = express()
app.use(express.json())

type APISession = { guildId: string; currentTrack: Track | undefined; queue: Track[]; repeat: boolean; shuffle: boolean }

export const downloadIds = new Collection<string, { track: Track; options?: StreamOptions }>()

app.use(cors())
app.use(express.static('./resources/static'))

app.get('/', (req, res) => {
	res.send(`The site isn't ready just yet :(`)
})

function verifySession(req: Request, res: Response, next: NextFunction) {
	try {
		const token = req.header('Authorization')?.split('Bearer ')[1].trim()
		if (token && authenticationService.authorize(token)) {
			next()
		}
	} catch (err) { }
	res.sendStatus(401)
}

app.post('/login', cors(), (req, res) => {
	const { username, password } = req.body
	const token = authenticationService.login(username, password)
	if (token) {
		res.setHeader('Authorization', `Bearer ${token}`)
		res.sendStatus(200)
	} else {
		res.sendStatus(403)
	}
})

app.get('/api/download/:downloadId', (req, res) => {
	let { track, options } = downloadIds.get(req.params.downloadId) || {}
	if (track) {
		// res.header(`Content-Disposition', 'attachment; filename="${track.title}"`)
		res.attachment(track.title + '.mp3')
		track.createAudioStream(options).pipe(res)
	} else {
		res.status(404).send('Download link is incorrect or has expired.')
	}
})

app.get('/api/download/:downloadId/webm', (req, res) => {
	let { track, options } = downloadIds.get(req.params.downloadId) || {}
	if (track) {
		// res.header(`Content-Disposition', 'attachment; filename="${track.title}"`)
		res.attachment(track.title + '.webm')
		track.createAudioStream(options).pipe(res)
	} else {
		res.status(404).send('Download link is incorrect or has expired.')
	}
})

app.get('/api/sessions', verifySession, (req, res) => {
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
