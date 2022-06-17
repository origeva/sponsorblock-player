import { startBot } from './bot'
import { startServer } from './server'
import './readline'
import { logger } from './logger'
import { Settings } from 'luxon'
Settings.defaultZone = 'utc+2'
logger.info(`Default timezone: utc+2`)
// import './memoryUsage'
startBot()
startServer()
