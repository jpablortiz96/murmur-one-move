import { defineConfig, type Plugin } from 'vite';
import { api } from './src/server/routes/api';

const localApiPlugin: Plugin = {
  name: 'murmur-local-api',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith('/api/')) {
        next();
        return;
      }

      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) headers.append(key, item);
          } else if (typeof value === 'string') {
            headers.set(key, value);
          }
        }

        const routeUrl = request.url.slice('/api'.length);
        if (routeUrl.startsWith('/round')) {
          response.statusCode = 503;
          response.setHeader('Content-Type', 'application/json');
          response.end(
            JSON.stringify({
              status: 'error',
              code: 'round-unavailable',
              message: 'Community Redis is available only inside a Reddit playtest',
            })
          );
          return;
        }
        const apiResponse = await api.fetch(
          new Request(`http://127.0.0.1:4173${routeUrl}`, {
            method: request.method ?? 'GET',
            headers,
          })
        );
        response.statusCode = apiResponse.status;
        apiResponse.headers.forEach((value, key) => response.setHeader(key, value));
        response.end(Buffer.from(await apiResponse.arrayBuffer()));
      } catch (error) {
        next(error);
      }
    });
  },
};

export default defineConfig({
  root: 'src/client',
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  plugins: [localApiPlugin],
});
