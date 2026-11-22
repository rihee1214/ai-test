const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const files = {'/':'index.html','/app.js':'app.js','/style.css':'style.css'}
http.createServer((req,res)=>{
  const file = files[req.url]
  if (typeof file !== 'string') {res.writeHead(404).end();return}
  res.setHeader('Content-Type',({'html':'text/html','js':'text/javascript','css':'text/css'})[file.split('.').pop()]+'; charset=utf-8')
  res.end(fs.readFileSync(path.join(__dirname,file)))
}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'))
