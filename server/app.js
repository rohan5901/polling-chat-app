const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const { pollData, chatMessages, users } = require('./data');

const uploadDir = path.resolve(__dirname, '../public/uploads');

// Ensure uploads directory exists asynchronously
fs.mkdir(uploadDir, { recursive: true })
  .catch(err => {
    if (err.code !== 'EEXIST') {
      console.error(`Error creating upload directory: ${err}`);
    }
  });

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

app.use(express.static('public'));

app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    const originalName = req.file.originalname;
    io.emit('file message', { user: users[req.body.userId], fileUrl, originalName });
    res.json({ fileUrl, originalName });
  } catch (err) {
    console.error(`Error uploading file: ${err}`);
    res.status(400).send('Error uploading file');
  }
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join', (username) => {
    users[socket.id] = username;
    io.emit('chat message', { user: 'System', message: `${username} has joined the chat` });
    io.emit('new poll', pollData);
  });

  socket.on('vote', ({ topic, option }) => {
    if (pollData[topic] && pollData[topic][option] !== undefined) {
      pollData[topic][option]++;
      io.emit('poll update', pollData);
    }
  });

  socket.on('chat message', (msg) => {
    const message = { user: users[socket.id], message: msg };
    chatMessages.push(message);
    io.emit('chat message', message);
  });

  socket.on('typing', () => {
    socket.broadcast.emit('typing', users[socket.id]);
  });

  socket.on('disconnect', () => {
    const disconnectedUser = users[socket.id];
    if (disconnectedUser) {
      io.emit('chat message', { user: 'System', message: `${disconnectedUser} has left the chat` });
      delete users[socket.id];
    }
  });

  socket.on('create poll', ({ topic, options }) => {
    if (!pollData[topic]) {
      pollData[topic] = {};
    }
    options.forEach(option => {
      pollData[topic][option] = 0;
    });
    io.emit('new poll', pollData);
  });
});

server.listen(3000, () => {
  console.log('Server listening on *:3000');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
