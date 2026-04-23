
// Entry point for Pulse Check
const express = require('express')
const monitorsRouter = require('./routes/monitors')
const cors = require("cors");

const app = express()
const PORT = process.env.PORT || 3000

// Middleware

app.use(express.json())
app.use(cors());

// Log request
app.use((req, _res, next) =>{
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
})


// Routes
app.get('/', (_req, res) => {
  res.json({
    name: 'Pulse-Check API',
    version: '1.0.0',
    description: "Dead Man's Switch for remote device monitoring",
    endpoints: {
      'POST /monitors':                'Register a new device monitor',
      'POST /monitors/:id/heartbeat':  'Send a heartbeat to reset the countdown',
      'POST /monitors/:id/pause':      'Pause a monitor (no alerts while paused)',
      'GET  /monitors/:id':            'Get the current status of a monitor',
      'GET  /monitors':                'List all monitors',
    },
  });
});
 
app.use('/monitors', monitorsRouter);


// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});
 
// Global error handler 
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});
 
// Start 
app.listen(PORT, () => {
  console.log(`\n Pulse-Check API running on http://localhost:${PORT}`);
  console.log('   Press Ctrl+C to stop.\n');
});
 
module.exports = app;












