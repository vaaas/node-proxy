'use strict'
import { existsSync, readdirSync } from 'node:fs'
import { createServer as createPlainServer } from 'node:http'
import { createServer as createSecureServer } from 'node:https'
import { WebSocketServer } from 'ws'

const on_request = SITES => (req, res) => {
	const f = SITES[req.headers.host]
	if (!f) {
		res.writeHead(404)
		res.end('Not found')
	} else f(req, res)
}

const on_upgrade = (server, SITES) => (req, socket, head) => {
	const f = SITES[req.headers.host]
	if (!f)
		return socket.destroy()
	server.handleUpgrade(req, socket, head, ws => server.emit('connection', f, req, ws))
}

const on_ws_connection = (f, req, socket) => f(req, socket)

function get_conf() {
	const cfile = existsSync('./conf.js') ? './conf.js' : './example.conf.js';
	if (cfile === './example.conf.js')
		console.warn('Configuration file not found. Using example configuration file')
	return import(cfile).then(x => x.default)
}

const pretty_name = x => x.split('.').slice(0, -1).join('.')

const attempt_read_dir = (dir) => {
	try { return readdirSync(dir) }
	catch (e) { return [] }
}

const import_all_defaults = async (dir) => {
	const xs = {}
	for (const x of attempt_read_dir(dir))
		xs[pretty_name(x)] = await import(`${dir}/${x}`).then(x => x.default)
	return xs
}

async function main() {
	const conf = await get_conf()
	const SITES = await import_all_defaults('./sites')
	const WS_SITES = await import_all_defaults('./websockets')

	const websocket_server = new WebSocketServer({ noServer: true })
		.on('connection', on_ws_connection)
	const server = conf.ssl
		? createSecureServer(conf.ssl)
		: createPlainServer()
	server.on('request', on_request(SITES))
		.on('upgrade', on_upgrade(websocket_server, WS_SITES))
	server.listen(conf.net.port, conf.net.host,
		() => console.log(
			`Server listening to ${conf.net.host}:${conf.net.port}`,
			`Sites enabled: ${Object.keys(SITES).join(', ')}`
		)
	)
}

main()
