const { applySecurityHeaders } = require("../security-headers");

function writeEvent(res, data) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function beginStream(res) {
  applySecurityHeaders(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 2000\n\n");
}

function createChunkWriter(res) {
  return (text) => {
    if (text) writeEvent(res, { type: "chunk", text });
  };
}

function endStream(res) {
  if (!res.writableEnded) res.end();
}

module.exports = { beginStream, createChunkWriter, endStream, writeEvent };
