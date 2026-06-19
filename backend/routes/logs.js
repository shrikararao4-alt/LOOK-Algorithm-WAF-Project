const express = require("express");
const router = express.Router();
const Log = require("../models/Log");

// GET the 15 most recent logs
router.get("/", async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 }).limit(15);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new log entry
router.post("/", async (req, res) => {
  const { action, details } = req.body;

  if (!action || !details) {
    return res.status(400).json({ message: "Action and details are required" });
  }

  const log = new Log({
    action,
    details,
  });

  try {
    const newLog = await log.save();
    res.status(201).json(newLog);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE all log entries (Bulk clear)
router.delete("/", async (req, res) => {
  try {
    await Log.deleteMany({});
    res.json({ message: "All system logs cleared successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
