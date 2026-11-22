import http from 'node:http'
import { readFile } from 'node:fs/promises'

const assets = new Map([
  ['/', ['index.html', 'text/html']], ['/app.mjs', ['app.mjs','text/javascript']],
  ['/schedule.mjs',['schedule.mjs','text/javascript']], ['/style.css',['style.css','text/css']]
])
const server = http.createServer(async (req,res) => {
  const asset = assets.get(req.url.split('?')[0])
  if (!asset) { res.writeHead(404).end(); return }
  try {
    const data = await readFile(new URL(asset[0],import.meta.url))
    res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8','Cache-Control':'no-store'}).end(data)
  } catch { res.writeHead(500).end('파일을 읽을 수 없습니다.') }
})
server.on('error', err => { console.error(err.message); process.exitCode=1 })
server.listen(43127,'127.0.0.1',()=>console.log('작은 영화제의 하루  http://127.0.0.1:43127'))
