const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const schema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3
  },
  favouriteGenre: {
    type: String,
    required: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
});

schema.plugin(uniqueValidator);

module.exports = mongoose.model('User', schema);