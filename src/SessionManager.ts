import Collection from '@discordjs/collection'
import { getVoiceConnection, VoiceConnection } from '@discordjs/voice'
import { logger } from './logger'
import { Listener, Session } from './Session'
import { generateRandomString } from './util'

export class SessionManager {
	private static instance: SessionManager
	public sessions = new Collection<string, Session>()
	public joinCodes = new Collection<string, Session>()

	private constructor() {}

	public static getInstance(): SessionManager {
		return this.instance || (this.instance = new SessionManager())
	}

	public createSession = (guildId: string, voiceChannelId: string): Session => {
		let session: Session = new Session(guildId)
		session.joinVoiceChannel({ guildId, channelId: voiceChannelId })
		this.sessions.set(guildId, session)
		return session
	}

	public deleteSession(session: Session): boolean {
		session.stop()
		session.clearTimeout()
		getVoiceConnection(session.guildId)?.destroy()
		return this.sessions.delete(session.guildId)
	}

	public async generateJoinCode(guildId: string): Promise<string | null> {
		let session = this.sessions.get(guildId)
		if (session) {
			let code: string
			do {
				code = await generateRandomString()
			} while (this.joinCodes.has(code))
			logger.debug(code)
			setTimeout(() => {
				this.joinCodes.delete(code)
			}, 1000 * 60 * 5)
			this.joinCodes.set(code, session)
			return code
		}
		return null
	}

	public joinSession(joinCode: string, listener: Listener): Session | null {
		let session = this.joinCodes.get(joinCode)
		if (session && !session.listeningGuildIds.includes('guildId')) {
			session.joinVoiceChannel(listener)
			return session
		}
		return null
	}
}
