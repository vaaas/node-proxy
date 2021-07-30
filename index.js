'use strict'
const http_server = require('http-server')
const cluster = require('cluster')
const os = require('os')
const fs = require('fs')

const CPUS = os.cpus().length
const CONF = JSON.parse(fs.readFileSync('conf.json'))
const SITES = Object.fromEntries(
	Object.entries(CONF.sites)
	.map(x => [x[0], require(`./sites/${x[1]}.js`)]))

function main() {
	if (cluster.isWorker) start_servers()
	else repeat(cluster.fork, CPUS)
}

function start_servers() {
	let host, port
	{
		const parts = CONF.listen.split(':')
		host = parts[0]
		port = parseFloat(parts[1])
	}
	if (CONF.ssl === false)
		http_server({ router: route, host, port })
	else {
		http_server({
			router: route,
			host,
			port,
			key: fs.readFileSync(CONF.ssl.key, 'utf8'),
			cert: fs.readFileSync(CONF.ssl.cert, 'utf8'),
		})
		http_server({ router: redirect, host, port })
	}
}

function route(request) {
	const f = SITES[request.headers.host]
	return f ? f(request) : Promise.resolve({
		status: 404,
		mimetype: 'text/plain',
		headers: [],
		data: 'Not found'
	})
}

const redirect = request => Promise.resolve({
	status: 307,
	mimetype: 'text/plain',
	data: 'Redirect',
	headers: [[ 'Location', request.headers.host + request.url ]]
})

function repeat(f, n) { for (let i = 0; i < n; i++) f() }

main()
