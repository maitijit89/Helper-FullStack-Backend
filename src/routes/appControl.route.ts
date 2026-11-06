import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { UpdateAppControlSchema, ToggleAppSchema } from '../schemas/appControl.schema';
import { appControlService } from '../services/appControl.service';

const router = Router();

// ==========================================
// 1. Public App Status Endpoint (For Mobile & Web Apps)
// ==========================================
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { app: queryApp } = req.query;
    const status = await appControlService.getStatus();

    if (queryApp === 'user') {
      res.status(200).json({
        success: true,
        data: status.user_app,
      });
      return;
    }

    if (queryApp === 'partner') {
      res.status(200).json({
        success: true,
        data: status.partner_app,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. Embedded Visual Web Dashboard for Admins
// ==========================================
router.get('/ui', async (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin App Control Center - Helper Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(22, 30, 49, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #3b82f6;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: radial-gradient(circle at top, #1e293b 0%, #0b0f19 100%);
      color: var(--text);
      min-height: 100vh;
      padding: 30px 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
      flex-wrap: wrap;
      gap: 15px;
    }
    h1 { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
    .badge {
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 9999px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .auth-box {
      display: flex;
      gap: 10px;
      align-items: center;
      background: rgba(15, 23, 42, 0.6);
      padding: 8px 14px;
      border-radius: 12px;
      border: 1px solid var(--card-border);
    }
    input[type="password"], input[type="text"], textarea {
      background: #0f172a;
      border: 1px solid #334155;
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 0.875rem;
      outline: none;
      font-family: inherit;
    }
    input:focus, textarea:focus { border-color: var(--primary); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
      margin-bottom: 30px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 26px;
      backdrop-filter: blur(12px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
    }
    .card.user::before { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
    .card.partner::before { background: linear-gradient(90deg, #10b981, #34d399); }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .card-title { font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.85rem;
    }
    .status-pill.running { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); }
    .status-pill.stopped { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .status-pill.running .status-dot { background: #10b981; box-shadow: 0 0 10px #10b981; }
    .status-pill.stopped .status-dot { background: #ef4444; box-shadow: 0 0 10px #ef4444; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
    .form-group input, .form-group textarea { width: 100%; }
    .form-group textarea { resize: vertical; min-height: 70px; }
    .btn {
      padding: 12px 20px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.95rem;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      font-family: inherit;
    }
    .btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
    .btn:active { transform: translateY(0); }
    .btn-danger { background: #dc2626; color: white; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35); }
    .btn-success { background: #059669; color: white; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35); }
    .btn-secondary { background: #334155; color: white; }
    .global-actions {
      display: flex;
      gap: 16px;
      justify-content: center;
      background: var(--card-bg);
      padding: 20px;
      border-radius: 16px;
      border: 1px solid var(--card-border);
      flex-wrap: wrap;
    }
    .info-toast {
      position: fixed;
      bottom: 25px;
      right: 25px;
      background: #1e293b;
      border: 1px solid #475569;
      color: #fff;
      padding: 14px 20px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      display: none;
      z-index: 1000;
      animation: fadeIn 0.3s;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>⚡ App Control Center <span class="badge" style="background:#3b82f6;color:#fff;">Admin</span></h1>
        <p style="color:var(--text-muted);font-size:0.9rem;margin-top:4px;">Pause or resume User and Partner apps instantly in production</p>
      </div>
      <div class="auth-box">
        <span style="font-size:0.85rem;color:var(--text-muted);">Admin Token:</span>
        <input type="password" id="adminToken" placeholder="Paste Bearer Token..." style="width:200px;">
        <button class="btn btn-secondary" onclick="saveToken()" style="padding:6px 12px;font-size:0.8rem;">Save</button>
      </div>
    </header>

    <div class="grid">
      <!-- User App Card -->
      <div class="card user">
        <div class="card-header">
          <div class="card-title">📱 Customer / User App</div>
          <div id="userStatusPill" class="status-pill running">
            <span class="status-dot"></span>
            <span id="userStatusText">RUNNING</span>
          </div>
        </div>
        <div class="form-group">
          <label>Maintenance Title</label>
          <input type="text" id="userTitle" value="User App Under Maintenance">
        </div>
        <div class="form-group">
          <label>Maintenance Message to Display to Users</label>
          <textarea id="userMessage">The Customer App is currently undergoing scheduled maintenance. We will be back shortly.</textarea>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button id="userActionBtn" class="btn btn-danger" style="flex:1;" onclick="toggleApp('user')">
            🛑 Stop User App
          </button>
        </div>
        <div id="userInfo" style="font-size:0.75rem;color:var(--text-muted);margin-top:12px;"></div>
      </div>

      <!-- Partner App Card -->
      <div class="card partner">
        <div class="card-header">
          <div class="card-title">🛵 Delivery Partner App</div>
          <div id="partnerStatusPill" class="status-pill running">
            <span class="status-dot"></span>
            <span id="partnerStatusText">RUNNING</span>
          </div>
        </div>
        <div class="form-group">
          <label>Maintenance Title</label>
          <input type="text" id="partnerTitle" value="Partner Deliveries Paused">
        </div>
        <div class="form-group">
          <label>Maintenance Message to Display to Partners</label>
          <textarea id="partnerMessage">The Delivery Partner App is temporarily paused. Please check back shortly.</textarea>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button id="partnerActionBtn" class="btn btn-danger" style="flex:1;" onclick="toggleApp('partner')">
            🛑 Stop Partner App
          </button>
        </div>
        <div id="partnerInfo" style="font-size:0.75rem;color:var(--text-muted);margin-top:12px;"></div>
      </div>
    </div>

    <div class="global-actions">
      <span style="font-weight:700;display:flex;align-items:center;color:var(--text-muted);">Emergency Operations:</span>
      <button class="btn btn-danger" onclick="toggleAll(true)">🚨 Emergency Stop All Apps</button>
      <button class="btn btn-success" onclick="toggleAll(false)">✅ Resume All Apps</button>
      <button class="btn btn-secondary" onclick="fetchStatus()">🔄 Refresh Status</button>
    </div>
  </div>

  <div id="toast" class="info-toast"></div>

  <script>
    let state = { user_app: { is_stopped: false }, partner_app: { is_stopped: false } };

    function getAuthHeader() {
      const token = localStorage.getItem('admin_access_token') || document.getElementById('adminToken').value.trim();
      return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    function saveToken() {
      const token = document.getElementById('adminToken').value.trim();
      if (token) {
        localStorage.setItem('admin_access_token', token);
        showToast('Admin token saved!');
        fetchStatus();
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/v1/admin/app-control', { headers: getAuthHeader() });
        if (res.status === 401 || res.status === 403) {
          // Fallback to public status view if unauthenticated
          const pubRes = await fetch('/api/v1/app-control/status');
          const pubData = await pubRes.json();
          if (pubData.success) render(pubData.data);
          return;
        }
        const data = await res.json();
        if (data.success) {
          state = data.data;
          render(data.data);
        }
      } catch (err) {
        console.error(err);
      }
    }

    function render(data) {
      const u = data.user_app;
      const p = data.partner_app;

      // User UI
      const uPill = document.getElementById('userStatusPill');
      const uText = document.getElementById('userStatusText');
      const uBtn = document.getElementById('userActionBtn');
      const uInfo = document.getElementById('userInfo');

      if (u.is_stopped) {
        uPill.className = 'status-pill stopped';
        uText.innerText = 'STOPPED';
        uBtn.className = 'btn btn-success';
        uBtn.innerHTML = '▶️ Resume User App';
        uInfo.innerText = 'Stopped at: ' + (u.stopped_at ? new Date(u.stopped_at).toLocaleString() : 'N/A');
      } else {
        uPill.className = 'status-pill running';
        uText.innerText = 'RUNNING';
        uBtn.className = 'btn btn-danger';
        uBtn.innerHTML = '🛑 Stop User App';
        uInfo.innerText = 'App is active and serving customers.';
      }
      if (u.title) document.getElementById('userTitle').value = u.title;
      if (u.message) document.getElementById('userMessage').value = u.message;

      // Partner UI
      const pPill = document.getElementById('partnerStatusPill');
      const pText = document.getElementById('partnerStatusText');
      const pBtn = document.getElementById('partnerActionBtn');
      const pInfo = document.getElementById('partnerInfo');

      if (p.is_stopped) {
        pPill.className = 'status-pill stopped';
        pText.innerText = 'STOPPED';
        pBtn.className = 'btn btn-success';
        pBtn.innerHTML = '▶️ Resume Partner App';
        pInfo.innerText = 'Stopped at: ' + (p.stopped_at ? new Date(p.stopped_at).toLocaleString() : 'N/A');
      } else {
        pPill.className = 'status-pill running';
        pText.innerText = 'RUNNING';
        pBtn.className = 'btn btn-danger';
        pBtn.innerHTML = '🛑 Stop Partner App';
        pInfo.innerText = 'App is active and dispatching deliveries.';
      }
      if (p.title) document.getElementById('partnerTitle').value = p.title;
      if (p.message) document.getElementById('partnerMessage').value = p.message;
    }

    async function toggleApp(app) {
      const isCurrentlyStopped = app === 'user' ? state.user_app.is_stopped : state.partner_app.is_stopped;
      const targetState = !isCurrentlyStopped;
      const title = document.getElementById(app + 'Title').value;
      const message = document.getElementById(app + 'Message').value;

      try {
        const res = await fetch('/api/v1/admin/app-control', {
          method: 'PATCH',
          headers: getAuthHeader(),
          body: JSON.stringify({
            app: app,
            is_stopped: targetState,
            title: title,
            message: message,
          }),
        });
        const json = await res.json();
        if (json.success) {
          showToast((targetState ? '🛑 Stopped ' : '✅ Resumed ') + app.toUpperCase() + ' App');
          fetchStatus();
        } else {
          alert(json.error?.message || 'Action failed');
        }
      } catch (err) {
        alert('Request error: ' + err.message);
      }
    }

    async function toggleAll(stop) {
      if (!confirm(stop ? 'Confirm EMERGENCY STOP for ALL apps?' : 'Resume ALL apps?')) return;
      try {
        const endpoint = stop ? '/api/v1/admin/app-control/stop-all' : '/api/v1/admin/app-control/start-all';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: getAuthHeader(),
          body: JSON.stringify({
            title: stop ? 'Service Temporarily Paused' : undefined,
            message: stop ? 'All services are temporarily paused by administrators.' : undefined,
          }),
        });
        const json = await res.json();
        if (json.success) {
          showToast(stop ? '🚨 All apps stopped' : '✅ All apps resumed');
          fetchStatus();
        } else {
          alert(json.error?.message || 'Action failed');
        }
      } catch (err) {
        alert('Request error: ' + err.message);
      }
    }

    window.onload = () => {
      const saved = localStorage.getItem('admin_access_token');
      if (saved) document.getElementById('adminToken').value = saved;
      fetchStatus();
      setInterval(fetchStatus, 10000);
    };
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
});

// ==========================================
// 3. Admin App Control Protected APIs
// ==========================================
router.use(authenticate, requireAdmin);

/**
 * GET /api/v1/admin/app-control
 * Fetches current detailed status of User & Partner apps.
 */
router.get(['/', ''], async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const status = await appControlService.getStatus(true);
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/app-control
 * Updates status for 'user', 'partner', or 'all' apps.
 */
router.patch(
  ['/', ''],
  validate(UpdateAppControlSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { app, is_stopped, title, message } = req.body;
      const adminIdentifier = req.user?.email || req.user?._id?.toString() || 'Admin';

      const updated = await appControlService.updateStatus({
        app,
        is_stopped,
        title,
        message,
        stopped_by: adminIdentifier,
      });

      res.status(200).json({
        success: true,
        message: `Successfully ${is_stopped ? 'stopped' : 'resumed'} ${app.toUpperCase()} application`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/admin/app-control/user/stop
 * Quick shortcut to stop User app.
 */
router.post(
  '/user/stop',
  validate(ToggleAppSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { title, message } = req.body || {};
      const adminIdentifier = req.user?.email || req.user?._id?.toString() || 'Admin';

      const updated = await appControlService.updateStatus({
        app: 'user',
        is_stopped: true,
        title: title || 'User App Under Maintenance',
        message:
          message ||
          'The Customer App is currently undergoing scheduled maintenance. We will be back shortly.',
        stopped_by: adminIdentifier,
      });

      res.status(200).json({
        success: true,
        message: 'User App has been stopped',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/admin/app-control/user/start
 * Quick shortcut to resume User app.
 */
router.post('/user/start', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adminIdentifier = req.user?.email || req.user?._id?.toString() || 'Admin';

    const updated = await appControlService.updateStatus({
      app: 'user',
      is_stopped: false,
      stopped_by: adminIdentifier,
    });

    res.status(200).json({
      success: true,
      message: 'User App has been resumed',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/app-control/partner/stop
 * Quick shortcut to stop Partner app.
 */
router.post(
  '/partner/stop',
  validate(ToggleAppSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { title, message } = req.body || {};
      const adminIdentifier = req.user?.email || req.user?._id?.toString() || 'Admin';

      const updated = await appControlService.updateStatus({
        app: 'partner',
        is_stopped: true,
        title: title || 'Partner Deliveries Paused',
        message:
          message ||
          'The Delivery Partner App is temporarily paused. Please check back shortly.',
        stopped_by: adminIdentifier,
      });

      res.status(200).json({
        success: true,
        message: 'Partner App has been stopped',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/admin/app-control/partner/start
 * Quick shortcut to resume Partner app.
 */
router.post('/partner/start', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adminIdentifier = req.user?.email || req.user?._id?.toString() || 'Admin';

    const updated = await appControlService.updateStatus({
      app: 'partner',
      is_stopped: false,
      stopped_by: adminIdentifier,
    });

    res.status(200).json({
      success: true,
      message: 'Partner App has been resumed',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/app-control/stop-all
 * Emergency switch to stop both User & Partner apps.
 */
router.post(
  '/stop-all',
  validate(ToggleAppSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { title, message } = req.body || {};
      const adminIdentifier = req.user?.email || req.user?._id?.toString() || 'Admin';

      const updated = await appControlService.updateStatus({
        app: 'all',
        is_stopped: true,
        title: title || 'Services Temporarily Paused',
        message:
          message ||
          'All services are temporarily paused for maintenance. Please check back soon.',
        stopped_by: adminIdentifier,
      });

      res.status(200).json({
        success: true,
        message: 'All applications have been stopped',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/admin/app-control/start-all
 * Resumes all applications.
 */
router.post('/start-all', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adminIdentifier = req.user?.email || req.user?._id?.toString() || 'Admin';

    const updated = await appControlService.updateStatus({
      app: 'all',
      is_stopped: false,
      stopped_by: adminIdentifier,
    });

    res.status(200).json({
      success: true,
      message: 'All applications have been resumed',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
