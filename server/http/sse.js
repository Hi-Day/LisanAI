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
  return (value) => {
    if (!value) return;
    // Streaming application services may emit structured domain events (for
    // example outcome-start/outcome-result) as well as raw text chunks. Keep
    // the SSE transport agnostic to the event shape instead of nesting a
    // structured event inside `chunk.text`.
    if (typeof value === "object" && !Array.isArray(value)) {
      return writeEvent(res, value);
    }
    return writeEvent(res, { type: "chunk", text: value });
  };
}

function endStream(res) {
  if (!res.writableEnded) res.end();
}

module.exports = { beginStream, createChunkWriter, endStream, writeEvent };
