/**
 * TDD feature: GET /api/notifications/summary
 * Tests written to specify behaviour before (or alongside) implementation.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpPath = path.join(os.tmpdir(), `wizz-jest-summary-${Date.now()}.json`);
process.env.WIZZ_JSON_PATH = tmpPath;
process.env.JWT_SECRET = 'jest-test-secret-summary';

const request = require('supertest');
const createApp = require('../app');

afterAll(() => {
  try {
    fs.unlinkSync(tmpPath);
  } catch (_) {
    /* ignore */
  }
});

describe('GET /api/notifications/summary (notification bell counts)', () => {
  const app = createApp();

  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get('/api/notifications/summary').expect(401);
  });

  it('returns total 0 and unread 0 for a new account', async () => {
    const reg = await request(app)
      .post('/api/register')
      .send({ username: 'summary_user_a', password: 'password123' })
      .expect(201);

    const res = await request(app)
      .get('/api/notifications/summary')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .expect(200);

    expect(res.body).toEqual({ total: 0, unread: 0 });
  });

  it('reflects seeded notifications (mixed read / unread)', async () => {
    const reg = await request(app)
      .post('/api/register')
      .send({ username: 'summary_user_b', password: 'password123' })
      .expect(201);

    const userId = reg.body.user.id;
    const db = require('../lib/db');

    db.createNotification({
      user_id: userId,
      type: 'test',
      title: 'One',
      message: 'msg',
      task_id: null,
    });
    const n2 = db.createNotification({
      user_id: userId,
      type: 'test',
      title: 'Two',
      message: 'msg',
      task_id: null,
    });
    db.markNotificationRead(n2.id, userId);

    const res = await request(app)
      .get('/api/notifications/summary')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .expect(200);

    expect(res.body).toEqual({ total: 2, unread: 1 });
  });

  it('updates unread to 0 after mark-all-read', async () => {
    const reg = await request(app)
      .post('/api/register')
      .send({ username: 'summary_user_c', password: 'password123' })
      .expect(201);

    const userId = reg.body.user.id;
    const db = require('../lib/db');
    db.createNotification({
      user_id: userId,
      type: 'test',
      title: 'Unread',
      message: 'x',
      task_id: null,
    });

    await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .expect(200);

    const res = await request(app)
      .get('/api/notifications/summary')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .expect(200);

    expect(res.body.unread).toBe(0);
    expect(res.body.total).toBe(1);
  });
});
