const mongoose = require("mongoose");

const ComparisonSchema = new mongoose.Schema({
  fcfsSeek: { type: Number, required: true },
  sstfSeek: { type: Number, required: true },
  scanSeek: { type: Number, required: true },
  cscanSeek: { type: Number, required: true },
  clookSeek: { type: Number, required: true },
});

const SimulationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  queue: { type: [Number], required: true },
  head: { type: Number, required: true },
  direction: { type: String, enum: ["left", "right"], required: true },
  createdAt: { type: Date, default: Date.now },
  lookResult: {
    sequence: { type: [Number], required: true },
    totalSeek: { type: Number, required: true },
    order: { type: [Number], required: true },
  },
  comparison: { type: ComparisonSchema, required: true },
});

module.exports = mongoose.model("Simulation", SimulationSchema);
