const http = require('http')
const https = require('https')
const fs = require('fs')

const CONF = JSON.parse(fs.readFileSync('conf.json'))
const SITES = Object.fromEntries(
	Object.entries(CONF.sites)
	.map(([k, v]) => [k, require('./sites/'+v+'.js')]))

main()

function main() {
	let server, host, port
	{
		const parts = CONF.listen.split(':')
		host = parts[0]
		port = parseFloat(parts[1])
	}
	if (CONF.ssl === false)
		server = http.createServer(request_handler)
	else {
		server = https.createServer({
			key: fs.readFileSync(CONF.ssl.key, 'utf8'),
			cert: fs.readFileSync(CONF.ssl.cert, 'utf8'),
		}, request_handler)
		redirect = http.createServer(redirect_handler)
		redirect.listen(80, host, () =>
			console.log('redirect server listening at', host + ':' + 80))
	}
	server.listen(port, host, () =>
		console.log('server listening at', CONF.listen))
}

function request_handler(request, socket) {
	const f = SITES[request.headers.host]
	if (f) f(request, socket)
	else {
		socket.writeHead(404)
		socket.end('Not found')
	}
}

function redirect_handler(request, socket) {
	socket.writeHead(307, {
		Location: request.headers.host + request.url
	})
	socket.end('')
}
