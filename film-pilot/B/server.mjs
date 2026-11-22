import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
const files={'/':'index.html','/app.mjs':'app.mjs','/model.mjs':'model.mjs','/style.css':'style.css'}
createServer(async(req,res)=>{
 const file=files[new URL(req.url,'http://localhost').pathname]
 if(!file){res.writeHead(404).end();return}
 try{const data=await readFile(new URL(file,import.meta.url));res.writeHead(200,{'Content-Type':({'html':'text/html','css':'text/css','mjs':'text/javascript'})[file.split('.').pop()]+'; charset=utf-8'}).end(data)}
 catch{res.writeHead(500).end()}
}).listen(43827,'127.0.0.1',()=>console.log('작은 영화제의 하루  http://127.0.0.1:43827'))

