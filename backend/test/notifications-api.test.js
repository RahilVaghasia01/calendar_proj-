/**
 * Test suite for the notification API (list, unread count, mark read, read-all).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpPath = path.join(os.tmpdir(), `wizz-jest-api-${Date.now()}.json`);
process.env.WIZZ_JSON_PATH = tmpPath;
process.env.JWT_SECRET = 'jest-test-secret-api';

const request = require('supertest');
const createApp = require('../app');

afterAll(() => {
  try {
    fs.unlinkSync(tmpPath);
  } catch (_) {
    /* ignore */
  }
});

describe('Notification API', () => {
  const app = createApp();

  async function register(username) {
    const res = await request(app)
      .post('/api/register')
      .send({ username, password: 'password123' })
      .expect(201);
    return res.body.token;
  }

  it('GET /api/notifications returns 401 without token', async () => {
    await request(app).get('/api/notifications').expect(401);
  });

  it('GET /api/notifications returns empty array for new user', async () => {
    const token = await register('notif_list_user');
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('GET /api/notifications/unread-count matches created notifications', async () => {
    const reg = await request(app)
      .post('/api/register')
      .send({ username: 'notif_count_user', password: 'password123' })
      .expect(201);
    const token = reg.body.token;
    const userId = reg.body.user.id;
    const db = require('../lib/db');

    db.createNotification({
      user_id: userId,
      type: 'x',
      title: 'A',
      message: '',
      task_id: null,
    });

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ count: 1 });
  });

  it('PATCH /api/notifications/:id/read marks one notification read', async () => {
    const reg = await request(app)
      .post('/api/register')
      .send({ username: 'notif_read_user', password: 'password123' })
      .expect(201);
    const token = reg.body.token;
    const userId = reg.body.user.id;
    const db = require('../lib/db');

    const n = db.createNotification({
      user_id: userId,
      type: 'x',
      title: 'Read me',
      message: '',
      task_id: null,
    });

    const res = await request(app)
      .patch(`/api/notifications/${n.id}/read`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.is_read).toBe(true);
    expect(res.body.id).toBe(n.id);
  });

  it('PATCH /api/notifications/read-all returns number updated', async () => {
    const reg = await request(app)
      .post('/api/register')
      .send({ username: 'notif_readall_user', password: 'password123' })
      .expect(201);
    const token = reg.body.token;
    const userId = reg.body.user.id;
    const db = require('../lib/db');

    db.createNotification({ user_id: userId, type: 'x', title: '1', message: '', task_id: null });
    db.createNotification({ user_id: userId, type: 'x', title: '2', message: '', task_id: null });

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.updated).toBe(2);
  });
});
