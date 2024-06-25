const socket = io();

// Function to prompt for username and join chat
async function promptUsername() {
  const username = prompt("Enter your username:");
  if (username) {
    socket.emit('join', username);
  } else {
    alert("Username is required to join the chat.");
    window.location.reload();
  }
}

// Function to send chat message
function sendMessage() {
  const messageInput = document.getElementById('message');
  const message = messageInput.value.trim();
  if (message) {
    socket.emit('chat message', message);
    messageInput.value = '';
  }
}

// Function to send file
async function sendFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', socket.id);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.fileUrl) {
        const fileMessage = {
          user: socket.id,
          fileUrl: data.fileUrl,
          originalName: file.name
        };
        socket.emit('file message', fileMessage);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  } else {
    alert("No file selected");
  }
}

// Function to indicate typing status
function typing() {
  socket.emit('typing');
}

// Function to add poll option input
function addOption() {
  const dynamicOptionsDiv = document.getElementById('dynamicOptions');
  const newOptionInput = document.createElement('input');
  newOptionInput.type = 'text';
  newOptionInput.name = 'options';
  newOptionInput.placeholder = 'Enter Option';
  dynamicOptionsDiv.appendChild(newOptionInput);
}

// Function to submit new poll
function submitPoll(event) {
  event.preventDefault();
  const topic = document.getElementById('topic').value.trim();
  const options = [...document.getElementsByName('options')]
    .map(option => option.value.trim())
    .filter(option => option);
  if (topic && options.length > 0) {
    socket.emit('create poll', { topic, options });
    event.target.reset();
  } else {
    alert("Topic and at least one option are required.");
  }
}

// Function to render poll data
function renderPollData(pollData) {
  const container = document.getElementById('polls-container');
  container.innerHTML = ''; // Clear the container

  for (const topic in pollData) {
    if (pollData.hasOwnProperty(topic)) {
      const poll = pollData[topic];
      const pollDiv = document.createElement('div');
      pollDiv.className = 'poll';

      const pollTopic = document.createElement('div');
      pollTopic.className = 'poll-topic';
      pollTopic.textContent = topic;
      pollDiv.appendChild(pollTopic);

      for (const option in poll) {
        if (poll.hasOwnProperty(option)) {
          const voteCount = poll[option];

          const optionDiv = document.createElement('div');
          optionDiv.className = 'poll-option';

          const optionButton = document.createElement('button');
          optionButton.textContent = `${option}: ${voteCount} votes`;
          optionButton.onclick = () => vote({ topic, option });

          optionDiv.appendChild(optionButton);
          pollDiv.appendChild(optionDiv);
        }
      }

      container.appendChild(pollDiv);
    }
  }

  // Scroll to the bottom of the container
  container.scrollTop = container.scrollHeight;
}

// Function to vote
function vote(pollUpdate) {
  socket.emit('vote', pollUpdate);
}

// Function to initialize the application
async function init() {
  await promptUsername();

  // Load poll data from server
  try {
    const response = await fetch('/pollData');
    const pollData = await response.json();
    renderPollData(pollData);
  } catch (error) {
    console.error('Error loading poll data:', error);
  }

  // Event listeners
  document.getElementById('pollForm').addEventListener('submit', submitPoll);

  socket.on('poll update', renderPollData);
  socket.on('new poll', renderPollData);
  socket.on('chat message', displayChatMessage);
  socket.on('file message', displayFileMessage);
  socket.on('typing', displayTypingStatus);
}

// Function to display chat message
function displayChatMessage(msg) {
  const messagesDiv = document.getElementById('messages');
  const messageElement = document.createElement('p');
  messageElement.innerHTML = `<strong>${msg.user}:</strong> ${msg.message}`;
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Function to display file message
function displayFileMessage(msg) {
  const messagesDiv = document.getElementById('messages');
  const fileElement = document.createElement('p');
  fileElement.innerHTML = `<strong>${msg.user}:</strong> <a href="${msg.fileUrl}" target="_blank">${msg.originalName}</a>`;
  messagesDiv.appendChild(fileElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Function to display typing status
function displayTypingStatus(username) {
  const typingDiv = document.getElementById('typing');
  typingDiv.innerText = `${username} is typing...`;
  setTimeout(() => { typingDiv.innerText = ''; }, 1000);
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
