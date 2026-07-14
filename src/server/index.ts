import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { api } from './routes/api';
import { menu } from './routes/menu';
import { triggers } from './routes/triggers';
import { expeditionApi } from './routes/expedition';
import { fieldNotesApi } from './routes/fieldNotes';
import { moderatorApi } from './routes/moderator';
import { schedulerRoutes } from './routes/scheduler';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/triggers', triggers);
internal.route('/scheduler', schedulerRoutes);

app.route('/api', api);
app.route('/api/expedition', expeditionApi);
app.route('/api/field-notes', fieldNotesApi);
app.route('/api/mod', moderatorApi);
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
