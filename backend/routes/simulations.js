const express = require("express");
const router = express.Router();
const Simulation = require("../models/Simulation");

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
