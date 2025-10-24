// server.js (Express) -- insecure rendering pattern
import express from 'express';
const app = express();
app.use(express.urlencoded({ extended: false }));

// naive storage for demo (in-memory)
const messages = [];

app.post('/message', (req, res) => {
  // store whatever user sends (no validation/escaping)
  messages.push({ user: req.body.user, text: req.body.text });
  res.redirect('/view');
});

app.get('/view', (req, res) => {
  // naive rendering: inserting raw text into HTML
  const html = `
    <html>
      <body>
        <h1>Messages</h1>
        <ul>
          ${messages.map(m => `<li><strong>${m.user}</strong>: ${m.text}</li>`).join('')}
        </ul>
        <form method="post" action="/message">
          <input name="user" placeholder="name" />
          <input name="text" placeholder="message" />
          <button>Send</button>
        </form>
      </body>
    </html>
  `;
  res.type('html').send(html);
});

app.listen(3000);
