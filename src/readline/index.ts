import readline from 'readline'
import { startBot, closeBot, client } from '../bot'
import { startServer, closeServer, server } from '../server'
import { Server } from 'http'

const rl = readline.createInterface(process.stdin, process.stdout)

rl.on('line', (input) => {
	input = input.trim()
	let command = input.split(' ')
	if (command[0] === 'exit') {
		process.exit()
		return
	} else if (command[0] === 'server') {
		if (command[1] === 'start') {
			if (!server) {
				startServer()
				// rl.write('Server starting...\n')
			} else {
				console.log('Server is already started')
			}
		} else if (command[1] === 'stop') {
			if (server) {
				closeServer()
				console.log('Server closing...')
			} else {
				console.log('Server is already stopped')
			}
		}
		return
	} else if (command[0] === 'bot') {
		if (command[1] === 'start') {
			if (!client) {
				startBot()
				console.log('Bot starting...')
			} else {
				console.log('Bot is already started')
			}
		} else if (command[1] === 'stop') {
			if (client) {
				closeBot()
				console.log('Bot closing...')
			} else {
				console.log('Bot is already closed...')
			}
		}
	}
	// console.log(JSON.stringify({ input }))
})
