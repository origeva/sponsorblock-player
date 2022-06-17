import { DatabaseInterface } from './interface'
import mongoose from 'mongoose'
import { Guild } from './mongoose/models/Guild.model'

const mongo = process.env.MONGODB_URI || 'mongodb://localhost/sbplayer/'

export class MongoDB implements DatabaseInterface {
	constructor() {
		mongoose.connect(mongo, { appName: 'SBPlayer', autoCreate: true })
	}
	getGuild(guildId: string): Promise<{ guildId: string }> {
		throw new Error()
		// Guild.findOne()
	}
}
