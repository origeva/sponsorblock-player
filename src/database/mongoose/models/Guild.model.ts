import mongoose, { Schema } from 'mongoose'

export const Guild = mongoose.model(
	'Guild',
	new Schema({
		guildId: String,
	})
)
