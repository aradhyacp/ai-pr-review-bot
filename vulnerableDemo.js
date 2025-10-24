import express from 'express';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, secret TEXT)`);
  db.run(`INSERT INTO users (username, secret) VALUES ('alice', 'alice_secret')`);
  db.run(`INSERT INTO users (username, secret) VALUES ('bob', 'bob_secret')`);

  db.run(`CREATE TABLE messages (id INTEGER PRIMARY KEY, user TEXT, message TEXT)`);
  db.run(`INSERT INTO messages (user, message) VALUES ('alice', 'hello world')`);
});

app.get('/', (req, res) => {
  res.type('html').send(`
    <h1>CTF Vulnerable Demo</h1>
    <ul>
      <li><a href="/user?name=alice">/user?name=alice (SQL injection demo)</a></li>
      <li><a href="/messages">/messages</a></li>
      <li><a href="/file?name=example.txt">/file?name=example.txt (path traversal demo)</a></li>
    </ul>
    <p>POST /messages with form data <code>user</code>, <code>message</code> to add messages.</p>
  `);
});

app.get('/user', (req, res) => {
  const name = req.query.name || '';
  const sql = "SELECT username, secret FROM users WHERE username = '" + name + "'";
  db.get(sql, (err, row) => {
    if (err) return res.status(500).send('DB error');
    if (!row) return res.status(404).send('No such user');
    res.type('html').send(`
      <h2>User info</h2>
      <p>Username: <strong>${row.username}</strong></p>
      <p>Secret: <strong>${row.secret}</strong></p>
      <p>Query used: <code>${escapeHtml(sql)}</code></p>
    `);
  });
});

app.get('/messages', (req, res) => {
  db.all("SELECT id, user, message FROM messages ORDER BY id DESC LIMIT 20", (err, rows) => {
    if (err) return res.status(500).send('DB error');
    const list = rows.map(r => `<li><strong>${r.user}</strong>: ${r.message}</li>`).join('');
    res.type('html').send(`
      <h2>Messages</h2>
      <ul>${list}</ul>
      <h3>Post a message</h3>
      <form method="post" action="/messages">
        <input name="user" placeholder="user"/>
        <input name="message" placeholder="message"/>
        <button type="submit">Send</button>
      </form>
    `);
  });
});


app.post('/messages', (req, res) => {
  const { user = 'anon', message = '' } = req.body;

  db.run("INSERT INTO messages (user, message) VALUES (?, ?)", [user, message], (err) => {
    if (err) return res.status(500).send('DB error');
    res.redirect('/messages');
  });
});


app.get('/file', (req, res) => {
  const name = req.query.name || 'example.txt';

  const filePath = path.resolve('./files', name);
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    res.type('text').send(data);
  } catch (e) {
    res.status(404).send('File not found');
  }
});

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

if (!fs.existsSync('./files')) {
  fs.mkdirSync('./files');
  fs.writeFileSync('./files/example.txt');
}

const server = app.listen(4000, () => {
  console.log('Vulnerable demo running at http://localhost:4000');
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});
