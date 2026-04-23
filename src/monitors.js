/*
In-memory store and timer management for all device monitors.
 */

// Map of monitorId -> monitor object
const monitors = new Map();




 // Fire the alert for a timed-out monitor.
 
function fireAlert(id) {
  const monitor = monitors.get(id);
  if (!monitor) return;

  monitor.status = 'down';
  monitor.timerId = null;

  const alert = {
    ALERT: `Device ${id} is down!`,
    alert_email: monitor.alert_email,
    time: new Date().toISOString(),
  };

  console.error('\nCRITICAL ALERT!!!!!!!!');
  console.error(JSON.stringify(alert, null, 2));
  console.error('--------------------\n');
}


//  Clear any running timer for a monitor.

function clearTimer(monitor) {
  if (monitor.timerId) {
    clearTimeout(monitor.timerId);
    monitor.timerId = null;
  }
}


 //Start (or restart) the countdown timer for a monitor.
 
function startTimer(monitor) {
  clearTimer(monitor);
  monitor.timerId = setTimeout(() => fireAlert(monitor.id), monitor.timeout * 1000);
}


// Public API


/*Register a new monitor.
@returns {{ success: boolean, message: string }}
 */
function registerMonitor(id, timeout, alert_email) {
  if (monitors.has(id)) {
    return { success: false, message: `Monitor with id '${id}' already exists.` };
  }

  /* @type {Monitor} */
  const monitor = {
    id,
    timeout,
    alert_email,
    status: 'active',
    createdAt: Date.now(),
    lastPing: Date.now(),
    timerId: null,
  };

  monitors.set(id, monitor);
  startTimer(monitor);

  return { success: true, message: `Monitor '${id}' registered. Countdown started (${timeout}s).` };
}

/*
Reset the heartbeat timer for a monitor.
 @returns {{ success: boolean, message: string, status?: string }}
 */
function heartbeat(id) {
  const monitor = monitors.get(id);

  if (!monitor) {
    return { success: false, message: `Monitor '${id}' not found.` };
  }

  if (monitor.status === 'down') {
    return { success: false, message: `Monitor '${id}' has already triggered. Re-register to restart monitoring.` };
  }

  // If paused, heartbeat un-pauses the monitor and restarts the timer
  monitor.status = 'active';
  monitor.lastPing = Date.now();
  startTimer(monitor);

  return { success: true, message: `Heartbeat received. Timer reset to ${monitor.timeout}s.`, status: monitor.status };
}

/*
 Pause a monitor (stops the timer; no alert will fire).
 
 @returns {{ success: boolean, message: string }}
 */
function pauseMonitor(id) {
  const monitor = monitors.get(id);

  if (!monitor) {
    return { success: false, message: `Monitor '${id}' not found.` };
  }

  if (monitor.status === 'down') {
    return { success: false, message: `Monitor '${id}' is already down and cannot be paused.` };
  }

  if (monitor.status === 'paused') {
    return { success: false, message: `Monitor '${id}' is already paused.` };
  }

  clearTimer(monitor);
  monitor.status = 'paused';

  return { success: true, message: `Monitor '${id}' paused. No alerts will fire until the next heartbeat.` };
}

/*
 Get the current status of a monitor (Developer's Choice feature).

 @returns {Monitor|null}
 */
function getMonitor(id) {
  return monitors.get(id) || null;
}

/*
 List all monitors (useful for admin dashboards).
 @returns {Monitor[]}
 */
function listMonitors() {
  return Array.from(monitors.values()).map(sanitize);
}

/*
 * Return a safe copy of a monitor (no internal timer handle).
 * @param {Monitor} monitor
 */
function sanitize(monitor) {
  const { timerId, ...safe } = monitor;
  return {
    ...safe,
    lastPing: new Date(safe.lastPing).toISOString(),
    createdAt: new Date(safe.createdAt).toISOString(),
  };
}

module.exports = {
  registerMonitor,
  heartbeat,
  pauseMonitor,
  getMonitor,
  listMonitors,
  sanitize,
};
