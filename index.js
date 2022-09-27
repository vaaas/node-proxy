'use strict'
import { existsSync, readdirSync } from 'node:fs'
import { createServer as createPlainServer } from 'node:http'
import { createServer as createSecureServer } from 'node:https'

const request_listener = SITES => (req, res) => {
	const f = SITES[req.headers.host]
	if (!f) {
		res.writeHead(404)
		res.end('Not found')
	} else f(req, res)
}

function get_conf() {
	const cfile = existsSync('./conf.js') ? './conf.js' : './example.conf.js';
	if (cfile === './example.conf.js')
		console.warn('Configuration file not found. Using example configuration file')
	return import(cfile).then(x => x.default)
}

const pretty_name = x => x.split('.').slice(0, -1).join('.')

async function make_sites() {
	const xs = {}
	for (const x of readdirSync('./sites'))
		xs[pretty_name(x)] = await import(`./sites/${x}`).then(x => x.default)
	return xs
}

async function main() {
	const conf = await get_conf()
	const SITES = await make_sites()

	const server = conf.ssl
		? createSecureServer(conf.ssl, request_listener(SITES))
		: createPlainServer(request_listener(SITES))

	server.listen(conf.net.port, conf.net.host,
		() => console.log(
			`Server listening to ${conf.net.host}:${conf.net.port}`,
			`Sites enabled: ${Object.keys(SITES).join(', ')}`
		)
	)
}

main()
