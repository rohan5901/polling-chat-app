const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pollSchema = new Schema({
  topic: { type: String, required: true },
  option: { type: Object, required: true },
});

module.exports = mongoose.model('Poll', pollSchema);
