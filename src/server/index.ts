import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { api } from './routes/api';
import { menu } from './routes/menu';
import { triggers } from './routes/triggers';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/triggers', triggers);

app.route('/api', api);
app.route('/internal', internal);

app.onError((error, c) => {
  console.error('Unhandled server error:', error);
  return c.json(
    { status: 'error', message: 'Unexpected server error' },
    500
  );
});

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
