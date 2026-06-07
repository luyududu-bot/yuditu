import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";

const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".mp4": "video/mp4",
  ".png": "image/png",
};

createServer((req, res) => {
  const requestPath = decodeURIComponent(req.url.split("?")[0]);
  let filePath = join(process.cwd(), requestPath === "/" ? "index.html" : requestPath);
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(process.cwd(), "index.html");
  res.setHeader("Content-Type", types[extname(filePath)] || "application/octet-stream");
  createReadStream(filePath).pipe(res);
}).listen(4173, () => console.log("屿地图运行于 http://localhost:4173"));
