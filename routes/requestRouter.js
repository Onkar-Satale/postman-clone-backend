import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();
const SECRET = "MY_SECRET_KEY";

// Middleware to authenticate user
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Token missing" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// POST proxy request and save history
router.post("/", authenticate, async (req, res) => {
  try {
    const { url, method, headers, params, body } = req.body;

    if (!url || !method) {
      return res.status(400).json({ status: 400, body: { error: "URL and Method are required" } });
    }

    const start = Date.now();

    // Send actual API request
    let apiResponse;
    try {
      apiResponse = await axios({
        url,
        method,
        headers: headers || {},
        params: params || {},
        data: body || {},
        validateStatus: () => true, // allow non-2xx responses
      });
    } catch (err) {
      apiResponse = err.response || { status: 500, data: { error: err.message } };
    }

    const duration = Date.now() - start;

    const responseData = {
      status: apiResponse.status,
      headers: apiResponse.headers || {},
      body: apiResponse.data || {},
    };

    // Save request to user history
    const historyEntry = {
      method,
      url,
      status: apiResponse.status,
      duration,
      responseBody: apiResponse.data || {},
      time: new Date(),
    };

    await User.findByIdAndUpdate(req.userId, { $push: { history: historyEntry } });

    res.json({
      success: true,
      ...responseData,
      duration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      duration: 0,
    });
  }
});

export default router;
