const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
require('./mongoose')

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// wanted to add poll data to db bu
const pollData = require('./pollData');

const User=require('./model/user')
const Message=require('./model/message')

const uploadDir = path.resolve(__dirname, '../public/uploads');

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

  socket.on('join', async (username) => {
    try {
      // Ensure username is unique
      let user = await User.findOne({ username });
      if (!user) {
        user = await User.create({ username });
      }
      socket.username = user.username;
      io.emit('chat message', { user: 'System', message: `${user.username} has joined the chat` });
      io.emit('new poll', pollData)
    } catch (err) {
      console.error('Error joining chat:', err);
    }
  });

  socket.on('chat message', async (msg) => {
    try {
      const message = new Message({ message: msg, user: socket.username });
      await message.save();
      io.emit('chat message', message);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  socket.on('typing', () => {
    socket.broadcast.emit('typing', socket.username);
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      io.emit('chat message', { user: 'System', message: `${socket.username} has left the chat` });
    }
  });

  socket.on('vote', ({ topic, option }) => {
    if (pollData[topic] && pollData[topic][option] !== undefined) {
      pollData[topic][option]++;
      io.emit('poll update', pollData);
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