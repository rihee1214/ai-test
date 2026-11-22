const http = require("node:http");
const path = require("node:path");
const { readFile } = require("node:fs/promises");

const host = "127.0.0.1";
const port = 4317;
const assets = new Map([
  ["/", ["index.html", "text/html"]],
  ["/index.html", ["index.html", "text/html"]],
  ["/styles.css", ["styles.css", "text/css"]],
  ["/app.mjs", ["app.mjs", "text/javascript"]],
  ["/views.mjs", ["views.mjs", "text/javascript"]],
  ["/schedule.mjs", ["schedule.mjs", "text/javascript"]],
]);

const server = http.createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  const asset = assets.get(request.url.split("?")[0]);
  if (!asset) {
    response.writeHead(404).end();
    return;
  }

  try {
    const [file, type] = asset;
    const content = await readFile(path.join(__dirname, "public", file));
    response.writeHead(200, {
      "Content-Type": type + "; charset=utf-8",
      "Content-Length": content.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(500).end();
  }
});

server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE"
    ? port + "번 포트가 사용 중입니다. 기존 영화제 서버가 실행 중인지 확인해 주세요."
    : error.message);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log("작은 영화제의 하루  http://" + host + ":" + port);
});
