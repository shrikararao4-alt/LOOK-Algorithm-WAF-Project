const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB Connection
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/look-disk-scheduling";
mongoose
  .connect(mongoURI)
  .then(() => console.log("Connected to MongoDB database successfully"))
  .catch((err) => console.error("Error connecting to MongoDB database:", err));

// Routes
const simulationsRouter = require("./routes/simulations");
app.use("/api/simulations", simulationsRouter);

// Base route for sanity check
app.get("/", (req, res) => {
  res.send("LOOK Disk Scheduling API is running.");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
