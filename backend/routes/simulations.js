const express = require("express");
const router = express.Router();
const Simulation = require("../models/Simulation");
const {
  computeLOOK,
  computeFCFS,
  computeSSTF,
  computeSCAN,
  computeCSCAN,
  computeCLOOK,
} = require("../utils/algorithms");

// GET all simulations
router.get("/", async (req, res) => {
  try {
    const simulations = await Simulation.find().sort({ createdAt: -1 });
    res.json(simulations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new simulation
router.post("/", async (req, res) => {
  const { title, queue, head, direction, lookResult, comparison } = req.body;

  if (!title || !queue || head === undefined || !direction || !lookResult || !comparison) {
    return res.status(400).json({ message: "Please provide all required fields" });
  }

  const simulation = new Simulation({
    title,
    queue,
    head,
    direction,
    lookResult,
    comparison,
  });

  try {
    const newSimulation = await simulation.save();
    res.status(201).json(newSimulation);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT route to rename a simulation
router.put("/:id", async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ message: "Title is required" });
  }

  try {
    const simulation = await Simulation.findById(req.params.id);
    if (!simulation) {
      return res.status(404).json({ message: "Simulation not found" });
    }
    simulation.title = title;
    const updated = await simulation.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT route to dynamically dispatch a new request to a running simulation queue
router.put("/:id/dispatch", async (req, res) => {
  const { track } = req.body;
  const trackNum = parseInt(track);

  if (track === undefined || isNaN(trackNum) || trackNum < 0 || trackNum > 199) {
    return res.status(400).json({ message: "Valid track number (0-199) is required" });
  }

  try {
    const simulation = await Simulation.findById(req.params.id);
    if (!simulation) {
      return res.status(404).json({ message: "Simulation not found" });
    }

    // Append new track to queue
    simulation.queue.push(trackNum);

    // Recalculate LOOK
    const lookRes = computeLOOK(simulation.queue, simulation.head, simulation.direction);
    simulation.lookResult = {
      sequence: lookRes.sequence,
      totalSeek: lookRes.totalSeek,
      order: lookRes.order
    };

    // Recalculate comparisons
    const fcfs = computeFCFS(simulation.queue, simulation.head);
    const sstf = computeSSTF(simulation.queue, simulation.head);
    const scan = computeSCAN(simulation.queue, simulation.head, simulation.direction);
    const cscan = computeCSCAN(simulation.queue, simulation.head, simulation.direction);
    const clook = computeCLOOK(simulation.queue, simulation.head, simulation.direction);

    simulation.comparison = {
      fcfsSeek: fcfs.totalSeek,
      sstfSeek: sstf.totalSeek,
      scanSeek: scan.totalSeek,
      cscanSeek: cscan.totalSeek,
      clookSeek: clook.totalSeek
    };

    const updatedSimulation = await simulation.save();
    res.json(updatedSimulation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE a simulation
router.delete("/:id", async (req, res) => {
  try {
    const simulation = await Simulation.findById(req.params.id);
    if (!simulation) {
      return res.status(404).json({ message: "Simulation not found" });
    }

    await Simulation.deleteOne({ _id: req.params.id });
    res.json({ message: "Simulation deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
