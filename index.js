'use strict'
const cluster = require('cluster')
const os = require('os')
const http = require('http')
const https = require('https')
const fs = require('fs')
const zlib = require('zlib')
const serve = require('serve')

const CPUS = os.cpus().length
const CONF = JSON.parse(fs.readFileSync('conf.json'))
const SITES = Object.fromEntries(
	Object.entries(CONF.sites)
	.map(x => [x[0], require(`./sites/${x[1]}.js`)]))

if (cluster.isWorker) main()
else repeat(cluster.fork, CPUS)

function main() {
	let server, host, port
	{
		const parts = CONF.listen.split(':')
		host = parts[0]
		port = parseFloat(parts[1])
	}

	if (CONF.ssl === false)
		server = http.createServer(route)
	else {
		server = https.createServer({
			key: fs.readFileSync(CONF.ssl.key, 'utf8'),
			cert: fs.readFileSync(CONF.ssl.cert, 'utf8'),
		}, route)
		rserver = http.createServer(redirect)
		rserver.listen(80, host, () =>
			console.log('redirect server listening at', host + ':' + 80))
	}
	server.listen(port, host, () =>
		console.log('server listening at', CONF.listen))
}

function route(request, socket) {
	const f = SITES[request.headers.host]
	if (f)
		f(request)
		.catch(e => ({ status: 500, mimetype: 'text/plain', data: e.message, headers: [] }))
		.then(serve(socket))
	else {
		socket.writeHead(404)
		socket.end('Not found')
	}
}

function redirect(request, socket) {
	socket.writeHead(307, {
		Location: request.headers.host + request.url
	})
	socket.end('')
}

function repeat(f, n) { for (let i = 0; i < n; i++) f() }
