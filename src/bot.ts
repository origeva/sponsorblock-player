import { ApplicationCommandData, Client, Collection, GuildMember, Intents } from 'discord.js'
import { getVoiceConnection, getVoiceConnections, AudioPlayerStatus } from '@discordjs/voice'
import ytdl from 'ytdl-core'
import { bold, hideLinkEmbed, hyperlink, inlineCode } from '@discordjs/builders'
import { StreamOptions } from './Track'
import { generateRandomString, isURL, stringToTimeInSeconds } from './util'
import { booleanToString, secondsToString, styleStatus, styleTrack, styleUrl } from './style'
import YouTube from './youtube/youtube'
import Spotify from './spotify'
import { downloadIds } from './server'
import { Category } from 'sponsorblock-api'
import { allCategories, inviteUrl, kaomojis, permitted, serverHostname, serverProtocol, stations } from './config'
import { logger } from './logger'
import { SessionManager } from './SessionManager'
import { RadioManager } from './stream/Radio'

const config = {
	MAX_CHARACTERS_PER_MESSAGE: 2000,
	GAP_FROM_ACTUAL: 5,
	RATE_LIMIT: process.env.RATE_LIMIT || 15,
}

export const youtube = new YouTube(process.env.YOUTUBE_API_TOKEN)
export const spotify = new Spotify()
const radioManager = RadioManager.getInstance()
const sessionManager = SessionManager.getInstance()

const requestsPerMinute = new Collection<string, number>() // <userId, requestsCount>
setInterval(() => {
	requestsPerMinute.clear()
}, 1000 * 60).unref()

const dmCommandsData: ApplicationCommandData[] = [
	{ name: 'invite', description: 'Invite me to your server!' },
	{ name: 'site', description: `The player's website. :)` },
	{ name: 'restart', description: 'Restart the bot.' },
]

const guildCommandsData: ApplicationCommandData[] = [
	// Guild
	{ name: 'play', description: 'Plays music.', options: [{ name: 'query', type: 'STRING', description: 'YouTube search query, URL or Spotify URL.', required: true }] },
	{
		name: 'radio',
		description: 'Play radio streams! Omit station to stop playing the radio.',
		options: [
			{
				name: 'station',
				type: 'STRING',
				description: 'Station to listen to.',
				choices: Object.keys(stations).map((station) => {
					return { name: station, value: station }
				}),
			},
		],
	},
	{ name: 'playlist', description: 'Plays a YouTube playlist.', options: [{ name: 'query', type: 'STRING', description: 'Playlist link or search query.', required: true }] },
	{
		name: 'join',
		description: `Joins the voice channel you're in.`,
		options: [{ name: 'channel', type: 'CHANNEL', channelTypes: ['GUILD_VOICE', 'GUILD_STAGE_VOICE'], description: 'Channel to join to.' }],
	},
	// Session
	{ name: 'disconnect', description: 'Disconnects from the voice channel.' },
	{
		name: 'move',
		description: `Moves to the voice channel you're in.`,
		options: [{ name: 'channel', type: 'CHANNEL', channelTypes: ['GUILD_VOICE', 'GUILD_STAGE_VOICE'], description: 'Channel to move to.' }],
	},
	{ name: 'current', description: 'Displays current track.' },
	{ name: 'queue', description: 'Displays queue.', options: [{ name: 'expand', type: 'BOOLEAN', description: 'Whether the queue should display all pages.' }] },
	// Same channel
	{ name: 'remove', description: 'Removes track from queue.', options: [{ name: 'index', type: 'INTEGER', description: 'Index of the track in the queue.', required: true }] },
	{ name: 'skip', description: 'Skips tracks.', options: [{ name: 'amount', type: 'INTEGER', description: 'Amount of tracks to skip (defaults to 1).' }] },
	{ name: 'fs', description: 'Force skip current track.' },
	{ name: 'pause', description: 'Pause current track.' },
	{ name: 'resume', description: 'Resumes current track.' },
	{ name: 'repeat', description: 'Toggles repeat.' },
	{ name: 'shuffle', description: 'Toggles shuffle.' },
	{ name: 'sb', description: 'Toggle SponsorBlock feature.' },
	{
		name: 'category',
		description: '[SB] Toggle skipping of a segment category.',
		options: [
			{
				name: 'category',
				type: 'STRING',
				description: 'The category to toggle the skipping of.',
				choices: allCategories.map((category) => {
					return { name: category, value: category }
				}),
			},
		],
	},
	// Current track
	{
		name: 'seek',
		description: 'Seeks to specific time in current track.',
		options: [{ name: 'timestamp', type: 'STRING', description: 'Timestamp format: hh:mm:ss (e.g. 19:03)', required: true }],
	},
	{ name: 'replay', description: 'Replays current track.' },
	{ name: 'download', description: 'Generate download link for the current song.' },
	// {
	// 	name: 'together',
	// 	description: 'Generate a code to join the same session on a different server.',
	// 	options: [{ name: 'code', type: 'STRING', description: 'The join code (Omit if you want to generate a code)' }],
	// },
]

export let client: Client<boolean> | undefined
export const startBot = () => {
	
	client = new Client({ intents: [Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] })

	client.once('ready', async (client) => {
		logger.info(`${client.user.username} ready!`)
		client.application.commands.set(dmCommandsData)
		let oauth2guilds = await client.guilds.fetch()
		oauth2guilds.forEach(async (guild) => {
			;(await guild.fetch()).commands.set(guildCommandsData)
		})
		logger.info(`Guilds: ${oauth2guilds.map((guild) => `${guild.name}`).join(' ')}`)
	})

	client.on('guildCreate', async (guild) => {
		logger.info(`Joined ${guild.name} !`)
		guild.commands.set(guildCommandsData)
	})

	client.on('guildDelete', (guild) => {
		logger.info(`Left ${guild.name}`)
		let session = sessionManager.sessions.get(guild.id)
		if (session) {
			sessionManager.deleteSession(session)
		}
	})

	client.on('voiceStateUpdate', (oldState, newState) => {
		if (oldState.id === client?.user?.id) {
			let newChannelId = newState.channelId
			if (newChannelId && oldState.channelId !== newChannelId) {
				let guildId = oldState.guild.id
				let session = sessionManager.sessions.get(guildId)
				if (session) {
					session.voiceChannelId = newChannelId
				}
			}
		}
	})

	client.on('interactionCreate', async (interaction) => {
		try {
			if (interaction.isCommand()) {
				if (interaction.user.bot) {
					interaction.reply(`I don't talk with other bots at the moment. :/`)
					return
				}
				let requests = requestsPerMinute.get(interaction.user.id) || 0
				if (requests === config.RATE_LIMIT) {
					interaction.reply(`You have reached the rate limit, try again soon.`)
					return
				} else {
					requestsPerMinute.set(interaction.user.id, requests + 1)
				}
				let commandName = interaction.commandName
				if (interaction.inGuild()) {
					let guildId = interaction.guildId
					// In guild commands
					if (commandName === 'play') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!channelId) {
							interaction.reply('You have to be in a voice channel for the bot to join you!')
							return
						}
						if (session && channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						if (session?.radioPlaying) {
							interaction.reply('Radio is playing, stop the radio for /play .')
							return
						}
						let query = interaction.options.getString('query', true)
						await interaction.reply(`Searching for ${isURL(query) ? hideLinkEmbed(query) : query}`)
						if (isURL(query)) {
							if (Spotify.isSpotifyURL(query)) {
								if (Spotify.urlResourceType(query) === 'track') {
									// interaction.followUp('Spotify Track')
									try {
										query = await spotify.getTrackName(query)
									} catch (err) {
										if (err.message === 'Invalid track ID.') {
											interaction.editReply('Invalid track ID.')
										} else {
											throw err
										}
										return
									}
								} else {
									interaction.editReply('Invalid resource.')
									return
								}
							}
						}

						if (!ytdl.validateURL(query)) {
							try {
								let result = await youtube.search(query)
								if (!result) {
									interaction.editReply(`Video was not found!`)
									return
								}
								query = `https://www.youtube.com/watch?v=${result}`
							} catch (err) {
								logger.error(err)
								interaction.editReply(`YouTube search error, let Ori know and use links for now :)`)
								return
							}
						}

						if (!session) {
							session = sessionManager.createSession(guildId, channelId)
						}
						let trackData = (await youtube.getTracks([YouTube.extractVideoID(query)]))[0]
						if (!trackData) {
							interaction.editReply(`Could not find the requested video.`)
							return
						}
						if (!session.playing) {
							interaction.editReply(`${bold('Playing')} :notes: ${styleTrack(trackData)}`)
							session.play(trackData)
						} else {
							interaction.editReply(`:thumbsup: Added ${styleTrack(trackData)} to the queue.`)
							session.addTrack(trackData)
						}
						return
					} else if (commandName === 'radio') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!channelId) {
							interaction.reply('You have to be in a voice channel for the bot to join you!')
							return
						}
						if (session && channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						let stationName = interaction.options.getString('station')
						if (!stationName) {
							if (session) {
								if (session.radioPlaying) {
									session.stopRadio()
									interaction.reply('Radio stopped.')
									return
								}
							}
							interaction.reply(
								`Available stations are:\n${Object.keys(stations)
									.map((station) => inlineCode(station))
									.join('\n')}`
							)
							return
						} else if (session) {
							if (session.playing && !session.radioPlaying) {
								interaction.reply('YouTube is playing, stop the music for /radio .')
								return
							}
						} else {
							session = sessionManager.createSession(guildId, channelId)
						}
						// else {
						// 	if (session.radioStation?.stationName === stationName) {
						// 		interaction.reply(`${styleUrl(session.radioStation.stationName, session.radioStation.siteUrl, true)} already playing`)
						// 		return
						// 	}
						// }
						let radioStation = await radioManager.getRadioStation(stationName)
						interaction.reply(`Now playing - ${styleUrl(stationName, radioStation.siteUrl)}`)
						session.playRadio(radioStation)
					} else if (commandName === 'playlist') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!channelId) {
							interaction.reply('You have to be in a voice channel for the bot to join you!')
							return
						}
						if (session && channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						if (session?.radioPlaying) {
							interaction.reply('Radio is playing, stop the radio for /playlist .')
							return
						}
						interaction.deferReply()
						let query = interaction.options.getString('query', true)
						if (!YouTube.isPlaylistURL(query)) {
							try {
								let result = await youtube.searchPlaylist(query)
								if (!result) {
									interaction.followUp(`Playlist was not found!`)
									return
								}
								query = `https://www.youtube.com/playlist?list=${result}`
							} catch (err) {
								logger.error(err)
								interaction.followUp(`YouTube search error, let Ori know and use links for now :)`)
								return
							}
						}

						if (!session) {
							session = sessionManager.createSession(guildId, channelId)
						}
						let playlistData = await youtube.getPlaylist(YouTube.extractPlaylistID(query))
						if (!playlistData) {
							interaction.followUp('Playlist not found.')
							return
						}
						if (!playlistData.tracks.length) {
							interaction.followUp('Playlist is empty.')
							return
						}
						interaction.followUp(
							`Added ${playlistData.tracks.length} tracks\n` +
								`${bold('Playlist')} ${styleUrl(playlistData.playlistTitle, `https://www.youtube.com/playlist?list=${playlistData.playlistId}`)} ${bold('by')} ${styleUrl(
									playlistData.channelTitle,
									`https://www.youtube.com/channel/${playlistData.channelId}`,
									true
								)}`
						)
						let i = 0
						if (session.audioPlayer.state.status === AudioPlayerStatus.Idle && !session.currentTrack) {
							i++
							let trackData = playlistData.tracks[0]
							interaction.followUp(`${bold('Playing')} :notes: ${styleTrack(trackData)}`)
							session.play(trackData)
						} else {
							interaction.followUp(`:thumbsup: Added ${playlistData.tracks.length} tracks to the queue.`)
						}
						for (i; i < playlistData.tracks.length; i++) {
							session.addTrack(playlistData.tracks[i])
						}
						return
					} else if (commandName === 'join') {
						let session = sessionManager.sessions.get(guildId)
						if (session) {
							interaction.reply('Bot has already joined a voice channel, try /move')
							return
						}
						let channel = interaction.options.getChannel('channel')
						if (channel && channel.type !== 'GUILD_VOICE' && channel.type !== 'GUILD_STAGE_VOICE') {
							interaction.reply(`You have to choose a ${bold('voice')} channel.`)
							return
						}
						let channelId = channel?.id || (interaction.member as GuildMember).voice.channelId
						if (!channelId) {
							interaction.reply('You must be in a voice channel or choose a channel for the bot to join to.')
							return
						}
						session = sessionManager.createSession(guildId, channelId)
						interaction.reply(':wave: Joined')
						return
					} else if (commandName === 'seek') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!session?.currentTrack) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						let timestamp = interaction.options.getString('timestamp', true)
						let seekTime = stringToTimeInSeconds(timestamp)
						if (seekTime === -1) {
							interaction.reply(`Invalid timestamp.`)
							return
						}
						if (seekTime > session.currentTrack.length) {
							interaction.reply(`Seek timestamp is after the end of the track :o`)
							return
						}
						interaction.reply(`Seeking to ${timestamp}`)
						session.play(session.currentTrack, seekTime)
						return
					} else if (commandName === 'queue') {
						let session = sessionManager.sessions.get(guildId)
						if (!session) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						let reply = styleStatus(
							`:repeat_one: ${booleanToString(session.repeat)} | :twisted_rightwards_arrows: ${booleanToString(session.shuffle)} | SB ${booleanToString(
								session.sbEnabled
							)} | ${secondsToString(session.queueTime)}`
						)
						if (!session.queue.length) {
							interaction.reply(reply + '\nNo tracks left in queue.')
							return
						}

						let queueString = session.queue.map((track, i) => inlineCode(i + 1 + ')') + styleTrack(track, true) + ' - ' + secondsToString(track.currentLength))

						let expand = interaction.options.getBoolean('expand')

						if (!expand) {
							let characters = reply.length
							for (let line of queueString) {
								if (line.length + characters < config.MAX_CHARACTERS_PER_MESSAGE) {
									characters += line.length + 2
									reply += '\n' + line
								} else {
									break
								}
							}
							interaction.reply(reply)
						} else {
							if (session.queue.length > 10) {
								interaction.deferReply()
								let characters = reply.length
								queueString.forEach((line) => {
									if (line.length + characters < config.MAX_CHARACTERS_PER_MESSAGE) {
										characters += line.length + 2
										reply += '\n' + line
									} else {
										interaction.followUp(reply)
										reply = line
										characters = line.length + 2
									}
								})
								interaction.followUp(reply)
							} else {
								reply += '\n' + queueString.join('\n')
								interaction.reply(reply)
							}
						}
						return
					} else if (commandName === 'sb') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!session) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						interaction.reply(`SponsorBlock ${session.toggleSponsorBlock() ? 'on' : 'off'}`)
						return
					} else if (commandName === 'category') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!session) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						let category = interaction.options.getString('category') as Category | null
						if (category) {
							interaction.reply(`SponsorBlock ${inlineCode(category)} ${session.toggleCategory(category) ? 'on' : 'off'}`)
						} else {
							interaction.reply(`SponsorBlock enabled categories:\n${session.categories.map((category) => inlineCode(category)).join('\n')}`)
						}
						return
					} else if (commandName === 'remove') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!session?.queue.length) {
							interaction.reply(`There's no tracks in the queue at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						let index = interaction.options.getInteger('index', true) - 1 // - 1 to match to queue index
						let removedTrack = session.queue.splice(index, 1)[0]
						if (!removedTrack) {
							interaction.reply('Wrong index value.')
							return
						}
						interaction.reply(`Removed ${styleTrack(removedTrack, true)} from the queue.`)
						return
					} else if (commandName === 'current') {
						let session = sessionManager.sessions.get(guildId)
						if (!session?.currentTrack) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						interaction.reply(`Currently playing: ${styleTrack(session.currentTrack)}`)
						return
					} else if (commandName === 'skip') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!session?.currentTrack) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						let amount = interaction.options.getInteger('amount') || 1
						let reply = 'Skipped! :fast_forward:'
						if (session.queue.length < amount - config.GAP_FROM_ACTUAL) {
							reply = `I mean there`
							if (session.queue.length) {
								if (session.queue.length === 1) {
									reply += `'s only one track`
								} else {
									reply += ` are only ${session.queue.length} tracks`
								}
							} else {
								reply += ` are no tracks`
							}
							reply += ` in the queue but consider it done!`
						}
						session.skip(amount)
						interaction.reply(reply)
						return
					} else if (commandName === 'fs') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						// if (!(session?.audioPlayer.state.status === AudioPlayerStatus.Playing)) {
						if (!session?.currentTrack) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						session.skip()
						interaction.reply('Skipped! :fast_forward: ')
						return
					} else if (commandName === 'disconnect') {
						// :)
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (session) {
							if (channelId === session.voiceChannelId) {
								sessionManager.deleteSession(session)
								interaction.reply(`:call_me: See ya'`)
								return
							} else {
								interaction.reply(`You have to be in the bot's channel for this command`)
								return
							}
						} else {
							interaction.reply(`I'm not connected.`)
							return
						}
					} else if (commandName === 'move') {
						let session = sessionManager.sessions.get(guildId)
						if (!session) {
							interaction.reply(`Bot isn't connected at the moment. Try /join`)
							return
						}
						let channel = interaction.options.getChannel('channel')
						// if (channel && channel.type !== 'GUILD_VOICE' && channel.type !== 'GUILD_STAGE_VOICE') {
						// 	// ?? Not needed anymore
						// 	interaction.reply(`You have to choose a ${bold('voice')} channel.`)
						// 	return
						// }
						let channelId = channel?.id || (interaction.member as GuildMember).voice.channelId
						if (!channelId) {
							await interaction.reply('You must be in a voice channel or choose a channel for the bot to move to.')
							return
						}
						if (channelId === session.voiceChannelId) {
							await interaction.reply(`I'm already here :face_palm:`)
							return
						}

						getVoiceConnection(guildId)?.destroy()
						session.joinVoiceChannel({ guildId, channelId })
						await interaction.reply('Moved.')
						return
					} else if (commandName === 'pause') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!session) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						session.audioPlayer.pause()
						interaction.reply(':pause_button: Paused')
						return
					} else if (commandName === 'resume') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!session) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						session.audioPlayer.unpause()
						interaction.reply(':arrow_forward: Resumed')
						return
					} else if (commandName === 'replay') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!session?.currentTrack) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						session.play(session.currentTrack)
						interaction.reply(`${bold('Replaying')} ${styleTrack(session.currentTrack, true)}`)
						return
					} else if (commandName === 'repeat') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!session) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						interaction.reply(`:repeat_one: Repeat ${session.toggleRepeat() ? 'on' : 'off'}`)
						return
					} else if (commandName === 'download') {
						let session = sessionManager.sessions.get(guildId)
						if (!session?.currentTrack) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						let downloadId: string
						do {
							downloadId = await generateRandomString()
						} while (downloadIds.has(downloadId))
						let track = session.currentTrack
						let options: StreamOptions | undefined = { container: 'mp3' }
						if (session.sbEnabled) {
							options.skipSegments = track.segments.filter((segment) => session?.categories.includes(segment.category)) // session?. :/
						}
						downloadIds.set(downloadId, { track, options })
						setTimeout(() => {
							downloadIds.delete(downloadId)
						}, 1000 * 60 * 5).unref()
						interaction.reply(`:arrow_down: Download ${hyperlink(bold(track.title), hideLinkEmbed(`${serverProtocol + serverHostname}/download/${downloadId}`))}`)
						return
					} else if (commandName === 'shuffle') {
						let channelId = (interaction.member as GuildMember).voice.channelId
						let session = sessionManager.sessions.get(guildId)
						if (!session) {
							interaction.reply(`There's nothing playing at the moment.`)
							return
						}
						if (channelId !== session.voiceChannelId) {
							interaction.reply(`You have to be in the bot's channel for this command`)
							return
						}
						interaction.reply(`:twisted_rightwards_arrows: Shuffle ${session.toggleShuffle() ? 'on' : 'off'}\nShuffle does ${bold('not')} work when skipping tracks`)
						return
					} else if (commandName === 'together') {
						let code = interaction.options.getString('code')
						let session = sessionManager.sessions.get(guildId)
						if (code) {
							if (session) {
								if (session.guildId === guildId) {
									interaction.reply('The server has an active session.')
								} else {
									interaction.reply('Already listening together.')
								}
								return
							}
							let channelId = (interaction.member as GuildMember).voice.channelId
							if (!channelId) {
								interaction.reply('You have to be in a voice channel for the bot to join you!')
								return
							}
							let joinedSession = sessionManager.joinSession(code, { guildId, channelId })
							if (joinedSession) {
								interaction.reply(`Listening together with ${joinedSession.guildId}`)
								return
							} else {
								interaction.reply('Code is invalid or has expired.')
								return
							}
						} else {
							let channelId = (interaction.member as GuildMember).voice.channelId
							if (!session) {
								interaction.reply('There is no active session on the server.')
								return
							}
							if (channelId !== session.voiceChannelId) {
								interaction.reply(`You have to be in the bot's channel for this command`)
								return
							}
							let code = await sessionManager.generateJoinCode(guildId)
							if (!code) {
								interaction.reply('Error occured, please try again.') // ??
							}
							interaction.reply(`Copy the following code: ${code}\nThe code will expire in 5 minutes`)
							return
						}
					}
				} else {
					// Has no guild
				}
				if (commandName === 'invite') {
					interaction.reply(hyperlink(bold('Invite me!'), hideLinkEmbed(inviteUrl)))
					return
				} else if (commandName === 'site') {
					interaction.reply(hyperlink(bold('Website'), hideLinkEmbed(serverProtocol + serverHostname)))
					return
				} else if (commandName === 'restart') {
					let id = interaction.user.id
					if (Object.values(permitted).includes(id)) {
						const randomKaomoji = kaomojis[Math.floor(Math.random() * kaomojis.length)]
						await interaction.reply(`${randomKaomoji} Restarting bot`)
						process.exit()
					}
					interaction.reply('Not today fella.')
					return
				}
			} else {
				if (interaction.channel?.type === 'DM') {
					interaction.channel.send(`Try using one of my '/' commands.`)
				}
			}
		} catch (err) {
			logger.error(err)
		}
	})

	return client.login(process.env.BOT_SECRET)
}

const exitHandler = (signal: Error | NodeJS.Signals) => {
	logger.warn(`Exit handler: ${signal}`)

	if (client) {
		// for (let connection of getVoiceConnections().values()) {
		// 	logger.info(`Destroying ${client.guilds.resolve(connection.joinConfig.guildId)?.name}'s voice connection`)
		// 	connection.destroy()
		// }
		client.destroy()
	}
	process.exit()
}
// process.once('beforeExit', () => {
// Linux close signal
process.on('SIGTERM', exitHandler)
// Do something when app is closing
// process.on('exit', exitHandler)
// Catches ctrl+c event
process.on('SIGINT', exitHandler)
// Catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', exitHandler)
// process.on('SIGUSR2', exitHandler)
// catches uncaught exceptions
process.on('uncaughtException', exitHandler)

export const closeBot = () => {
	if (client) {
		client.destroy()
		sessionManager.sessions.clear()
		for (let connection of getVoiceConnections().values()) {
			logger.info(`Destroying ${client.guilds.resolve(connection.joinConfig.guildId)?.name}'s voice connection`)
			connection.destroy()
		}
		client = undefined
		return true
	} else {
		return false
	}
}

// setInterval(() => {
// 	sessions.forEach((session) => {
// 		client.channels
// 	})
// }).unref()
