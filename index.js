import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import axios from "axios";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/userRoutes.js";
import historyRoutes from "./routes/history.js";
import User from "./models/User.js";

const app = express();
const SECRET = "MY_SECRET_KEY";

// -----------------------------
// Connect to MongoDB
// -----------------------------
mongoose
  .connect("mongodb://127.0.0.1:27017/postman-clone")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// -----------------------------
// Middleware
// -----------------------------
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// -----------------------------
// Base route
// -----------------------------
app.get("/", (req, res) => res.send("Backend is running..."));

// -----------------------------
// Proxy API request and save history
// -----------------------------
app.post("/api/request", async (req, res) => {
  try {
    let userId = null;

    // Check for token (optional for guest users)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, SECRET);
        userId = decoded.userId; // logged-in user
      } catch (err) {
        console.warn("Invalid token, proceeding as guest");
      }
    }

    const { url, method, body } = req.body;
    if (!url || !method)
      return res.status(400).json({ error: "URL and Method are required" });

    const start = Date.now();
    let apiResponse;

    try {
      apiResponse = await axios({
        url,
        method,
        data: body,
        validateStatus: () => true, // allow non-2xx responses
      });
    } catch (err) {
      apiResponse = err.response || { status: "ERR", data: {} };
    }

    const duration = Date.now() - start;

    // Save history in DB only if user is logged in
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        $push: {
          history: {
            url,
            method,
            status: apiResponse.status || "ERR",
            duration,
            responseBody: apiResponse.data || {},
            time: new Date(),
          },
        },
      });
    }

    res.json({
      success: true,
      status: apiResponse.status || "ERR",
      body: apiResponse.data || {},
      duration,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, duration: 0 });
  }
});

// -----------------------------
// Routes
// -----------------------------
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/history", historyRoutes);

// -----------------------------
// Start server
// -----------------------------
const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
