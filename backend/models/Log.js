const mongoose = require("mongoose");

const LogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  details: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Log", LogSchema);
