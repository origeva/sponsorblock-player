import readline from 'readline'

setInterval(() => {
	const used = process.memoryUsage()
	process.stdout.write('------------------------------------------------------\n')
	process.stdout.write(`arrayBuffers ${Math.round((used.arrayBuffers / 1024 / 1024) * 100) / 100} MB\n`)
	process.stdout.write(`external ${Math.round((used.external / 1024 / 1024) * 100) / 100} MB\n`)
	process.stdout.write(`heapTotal ${Math.round((used.heapTotal / 1024 / 1024) * 100) / 100} MB\n`)
	process.stdout.write(`heapUsed ${Math.round((used.heapUsed / 1024 / 1024) * 100) / 100} MB\n`)
	process.stdout.write(`rss ${Math.round((used.rss / 1024 / 1024) * 100) / 100} MB\n`)
	readline.moveCursor(process.stdout, 0, -6)
}, 2000).unref()
