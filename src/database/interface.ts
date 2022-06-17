export interface Database {
	getGuild(guildId: string): Promise<DBGuild>
}

type DBGuild = { guildId: string }
