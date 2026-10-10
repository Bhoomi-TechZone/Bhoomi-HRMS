const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  console.log("[setupProxy] Configuring proxies...");

  // Proxy API requests to backend
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:9410",
      changeOrigin: true,
      pathRewrite: {
        "^/api": "/api",
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(
          `[Proxy] ${req.method} ${req.url} -> ${proxyRes.statusCode}`
        );
      },
      onError: (err, req, res) => {
        console.error("[Proxy Error]", req.url, err.message);
        res.status(503).json({ error: "Proxy error: " + err.message });
      },
    })
  );

  // Proxy websocket connections
  app.use(
    ["/ws", "/socket.io"],
    createProxyMiddleware({
      target: "http://localhost:9410",
      changeOrigin: true,
      ws: true,
      logLevel: "warn",
      onError: (err, req, res) => {
        console.error("[WS Proxy Error]", req.url, err.message);
      },
    })
  );
};
