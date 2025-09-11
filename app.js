require('dotenv').config();
const express = require('express');
const { createClient } = require('@libsql/client');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const app = express();

app.use(cors());
app.use(express.json());

// Error handlers
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

// --- Helper function ---
const convertUser = row => ({
  userId: row.id,
  userName: row.username,
  email: row.email,
});

// --- Signup API ---
app.post('/signup', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const existingUser = await db.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email],
    });

    if (existingUser.rows.length > 0) {
      return res.status(400).send("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute({
      sql: "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
      args: [username, email, hashedPassword, role],
    });

    res.status(201).json({ message: "User successfully added" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding user" });
  }
});

// --- Login API ---
app.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    const result = await db.execute({
      sql: "SELECT * FROM users WHERE username = ?",
      args: [username],
    });

    if (result.rows.length === 0) {
      return res.status(400).send("Invalid user");
    }

    const user = result.rows[0];

    const isPasswordMatched = await bcrypt.compare(password, user.password);

    if (user.role !== role) {
      return res.status(400).send("Invalid role");
    }

    if (!isPasswordMatched) {
      return res.status(400).send("Invalid password");
    }

    const payload = { username: user.username };
    const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN');

    res.json({ jwtToken, userid: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error logging in");
  }
});

// --- Get all users ---
app.get('/users', async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM users");
    res.json(result.rows.map(convertUser));
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching users");
  }
});

// --- Get single user ---
app.get('/users/:userid', async (req, res) => {
  try {
    const { userid } = req.params;

    const result = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [userid],
    });

    if (result.rows.length === 0) {
      return res.status(404).send({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Get logs for a user ---
app.get('/userlogs/:userid', async (req, res) => {
  try {
    const { userid } = req.params;

    const result = await db.execute({
      sql: "SELECT * FROM userlogs WHERE user_id = ?",
      args: [userid],
    });

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching logs");
  }
});

// --- Get single log ---
app.get('/userlogs/:userid/:logid', async (req, res) => {
  try {
    const { userid, logid } = req.params;

    const result = await db.execute({
      sql: "SELECT * FROM userlogs WHERE user_id = ? AND id = ?",
      args: [userid, logid],
    });

    if (result.rows.length === 0) {
      return res.status(404).send({ message: "Log not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching log:", error);
    res.status(500).send({ message: "Error fetching log" });
  }
});

// --- Add log ---
app.post('/userlogs/:userid', async (req, res) => {
  try {
    const { userid } = req.params;
    const { date, yesterday, today, blocker } = req.body;

    await db.execute({
      sql: "INSERT INTO userlogs (user_id, date, yesterday, today, blocker) VALUES (?, ?, ?, ?, ?)",
      args: [userid, date, yesterday, today, blocker],
    });

    res.send("Log successfully added");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error adding log");
  }
});

// --- Delete log ---
app.delete('/userlogs/delete/:userid/:logid', async (req, res) => {
  try {
    const { userid, logid } = req.params;

    const result = await db.execute({
      sql: "DELETE FROM userlogs WHERE user_id = ? AND id = ?",
      args: [userid, logid],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: "Log not found" });
    }

    res.json({ message: "Log successfully deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting log" });
  }
});

// --- Update log ---
app.post('/userlogs/update/:userid/:logid', async (req, res) => {
  try {
    const { userid, logid } = req.params;
    const { date, yesterday, today, blocker } = req.body;

    const result = await db.execute({
      sql: `
        UPDATE userlogs
        SET date = ?, yesterday = ?, today = ?, blocker = ?
        WHERE user_id = ? AND id = ?
      `,
      args: [date, yesterday, today, blocker, userid, logid],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: "Log not found or not updated" });
    }

    res.json({ message: "Log updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating log");
  }
});

app.listen(3001, () =>
  console.log("Server Running at http://localhost:3001/")
);

module.exports = app;
