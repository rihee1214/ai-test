import http from 'node:http'
import {readFile} from 'node:fs/promises'
const types={'index.html':'text/html','style.css':'text/css','app.mjs':'text/javascript','model.mjs':'text/javascript'}
http.createServer(async(req,res)=>{
  const name=req.url==='/'?'index.html':req.url.slice(1)
  if(!Object.hasOwn(types,name)){res.writeHead(404).end();return}
  try{
    const data=await readFile(new URL(name,import.meta.url))
    res.writeHead(200,{'Content-Type':types[name]+'; charset=utf-8','Cache-Control':'no-store'}).end(data)
  }catch{res.writeHead(500).end()}
}).listen(43871,'127.0.0.1',()=>console.log('작은 영화제의 하루  http://127.0.0.1:43871'))
