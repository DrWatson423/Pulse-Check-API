/*
routes/monitors.js
All /monitors route handlers.
 */

const express = require('express');
const router = express.Router();
const store = require('../monitors');


// POST /monitors
// Register a new monitor

router.post('/', (req, res) => {
  const { id, timeout, alert_email } = req.body;

  // Validate required fields
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return res.status(400).json({ error: 'Field "id" is required and must be a non-empty string.' });
  }
  if (timeout === undefined || typeof timeout !== 'number' || timeout <= 0) {
    return res.status(400).json({ error: 'Field "timeout" is required and must be a positive number (seconds).' });
  }
  if (!alert_email || typeof alert_email !== 'string') {
    return res.status(400).json({ error: 'Field "alert_email" is required.' });
  }

  const result = store.registerMonitor(id.trim(), timeout, alert_email.trim());

  if (!result.success) {
    return res.status(409).json({ error: result.message });
  }

  return res.status(201).json({ message: result.message });
});


// POST /monitors/:id/heartbeat
// Reset the countdown for a monitor

router.post('/:id/heartbeat', (req, res) => {
  const { id } = req.params;
  const result = store.heartbeat(id);

  if (!result.success) {
    const code = result.message.includes('not found') ? 404 : 409;
    return res.status(code).json({ error: result.message });
  }

  return res.status(200).json({ message: result.message, status: result.status });
});


// POST /monitors/:id/pause
// Pause a monitor (Bonus: Snooze Button)

router.post('/:id/pause', (req, res) => {
  const { id } = req.params;
  const result = store.pauseMonitor(id);

  if (!result.success) {
    const code = result.message.includes('not found') ? 404 : 409;
    return res.status(code).json({ error: result.message });
  }

  return res.status(200).json({ message: result.message });
});


// GET /monitors/:id  (Developer's Choice)
// Retrieve the current state of a monitor

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const monitor = store.getMonitor(id);

  if (!monitor) {
    return res.status(404).json({ error: `Monitor '${id}' not found.` });
  }

  return res.status(200).json(store.sanitize(monitor));
});




// GET /monitors  (Developer's Choice)
// List all monitors

router.get('/', (req, res) => {
  return res.status(200).json(store.listMonitors());
});

module.exports = router;