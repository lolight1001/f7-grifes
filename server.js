// F7 Grifes — servidor da loja + painel admin
// Não usa nenhuma biblioteca externa: só o Node.js puro.
// Por padrão (host = 127.0.0.1) só escuta neste computador. Pra colocar
// o site no ar de verdade, veja o guia em PUBLICAR.md — ele explica como
// mudar o "host" com segurança (senha forte, HTTPS, hospedagem).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

// ---------- configuração ----------
const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'config.json');
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const ORDERS_FILE = path.join(ROOT, 'data', 'orders.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

function loadConfig() {
  const defaults = { host: '127.0.0.1', port: 3000, adminPassword: 'mudaressasenha123' };
  let parsed = {};
  try {
    parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    parsed = {};
  }
  const merged = Object.assign({}, defaults, parsed);
  let needsSave = Object.keys(defaults).some((k) => !(k in parsed));
  if (!merged.dropDate) {
    // Data fixa de verdade (não recalcula a cada acesso). Pode editar em config.json.
    merged.dropDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    needsSave = true;
  }
  if (needsSave) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
  }
  // Variáveis de ambiente (usadas por praticamente toda hospedagem em nuvem)
  // têm prioridade sobre o config.json, sem precisar editar o arquivo.
  if (process.env.PORT) merged.port = parseInt(process.env.PORT, 10);
  if (process.env.HOST) merged.host = process.env.HOST;
  if (process.env.F7_ADMIN_PASSWORD) merged.adminPassword = process.env.F7_ADMIN_PASSWORD;
  return merged;
}
let CONFIG = loadConfig();

// ---------- garantir pastas/arquivos ----------
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]');
}
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, '[]');
}

// ---------- helpers de dados ----------
function readProducts() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}
function writeProducts(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}
function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}
function writeOrders(list) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(list, null, 2));
}

// ---------- helpers http ----------
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  }, SECURITY_HEADERS));
  res.end(body);
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJSONBody(req, limitBytes) {
  const buf = await readBody(req, limitBytes || 5 * 1024 * 1024);
  if (!buf.length) return {};
  return JSON.parse(buf.toString('utf8'));
}

function isAdmin(req) {
  const token = req.headers['x-admin-token'] || '';
  return token && token === CONFIG.adminPassword;
}

// ---------- limite de tentativas de login (protege contra força bruta) ----------
const loginAttempts = new Map(); // ip -> { count, resetAt }
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= LOGIN_MAX_ATTEMPTS;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin') pathname = '/admin.html';

  const safeSuffix = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safeSuffix);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Proibido');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SECURITY_HEADERS));
      res.end('Não encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream' }, SECURITY_HEADERS));
    res.end(data);
  });
}

// ---------- validação de produto ----------
const CATEGORIES = ['camisetas', 'moletons', 'calcas', 'tenis', 'acessorios', 'kits'];
const BADGES = ['', 'NOVO', 'EDIÇÃO LIMITADA'];

function sanitizeProductInput(body, existing) {
  const p = Object.assign({}, existing || {});
  if (typeof body.name === 'string' && body.name.trim()) p.name = body.name.trim().slice(0, 120);
  if (CATEGORIES.includes(body.category)) p.category = body.category;
  if (body.price !== undefined) {
    const n = Number(body.price);
    if (!Number.isFinite(n) || n < 0) throw new Error('Preço inválido');
    p.price = n;
  }
  if (body.originalPrice !== undefined) {
    if (body.originalPrice === null || body.originalPrice === '') {
      p.originalPrice = null;
    } else {
      const n = Number(body.originalPrice);
      if (!Number.isFinite(n) || n < 0) throw new Error('Preço original inválido');
      p.originalPrice = n;
    }
  }
  if (Array.isArray(body.sizes)) {
    p.sizes = body.sizes.map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
  }
  if (BADGES.includes(body.badge)) p.badge = body.badge;
  if (typeof body.image === 'string') p.image = body.image;
  if (typeof body.visible === 'boolean') p.visible = body.visible;
  return p;
}

// ---------- pedidos ----------
const ORDER_STATUSES = ['novo', 'confirmado', 'enviado', 'cancelado'];

function buildOrderFromRequest(body) {
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error('O carrinho está vazio.');
  }
  const products = readProducts();
  const items = [];
  for (const raw of body.items) {
    const product = products.find((p) => p.id === raw.productId);
    if (!product) continue;
    const qty = Math.max(1, Math.min(99, parseInt(raw.qty, 10) || 1));
    items.push({
      productId: product.id,
      name: product.name,
      price: product.price, // preço confirmado no servidor, nunca confia no que o cliente manda
      size: raw.size ? String(raw.size).slice(0, 20) : '',
      qty,
      image: product.image || ''
    });
  }
  if (items.length === 0) {
    throw new Error('Nenhum item do carrinho é válido (produto pode ter sido removido da loja).');
  }

  const customer = body.customer || {};
  if (!customer.name || !String(customer.name).trim()) throw new Error('Informe seu nome.');
  if (!customer.phone || !String(customer.phone).trim()) throw new Error('Informe um telefone/WhatsApp.');

  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);

  return {
    id: crypto.randomUUID(),
    items,
    customer: {
      name: String(customer.name).trim().slice(0, 120),
      phone: String(customer.phone).trim().slice(0, 40),
      address: customer.address ? String(customer.address).trim().slice(0, 200) : '',
      city: customer.city ? String(customer.city).trim().slice(0, 100) : '',
      note: customer.note ? String(customer.note).trim().slice(0, 300) : ''
    },
    total,
    status: 'novo',
    createdAt: Date.now()
  };
}

// ---------- upload de imagem (base64, sem libs externas) ----------
function saveUploadedImage(dataUrl) {
  const match = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Formato de imagem inválido (use PNG, JPG, WEBP ou GIF)');
  let ext = match[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) throw new Error('Imagem muito grande (máximo 8MB)');
  const filename = crypto.randomUUID() + '.' + ext;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
  return '/uploads/' + filename;
}

// ---------- servidor ----------
const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(parsed.pathname);

    // ----- API pública -----
    if (pathname === '/api/products' && req.method === 'GET') {
      const list = readProducts().filter((p) => p.visible !== false);
      return sendJSON(res, 200, list);
    }

    if (pathname === '/api/settings' && req.method === 'GET') {
      return sendJSON(res, 200, { dropDate: CONFIG.dropDate });
    }

    // ----- login (checagem de senha, apenas para a UI mostrar erro) -----
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'unknown';
      if (!checkLoginRateLimit(ip)) {
        return sendJSON(res, 429, { ok: false, error: 'Muitas tentativas. Aguarde alguns minutos.' });
      }
      const body = await readJSONBody(req, 1024);
      if (body.password === CONFIG.adminPassword) return sendJSON(res, 200, { ok: true });
      return sendJSON(res, 401, { ok: false, error: 'Senha incorreta' });
    }

    // ----- pedidos (cliente cria, sem precisar de senha) -----
    if (pathname === '/api/orders' && req.method === 'POST') {
      const body = await readJSONBody(req, 512 * 1024);
      let order;
      try {
        order = buildOrderFromRequest(body);
      } catch (validationErr) {
        return sendJSON(res, 400, { error: validationErr.message });
      }
      const list = readOrders();
      list.unshift(order);
      writeOrders(list);
      return sendJSON(res, 201, order);
    }

    // ----- tudo abaixo de /api/admin exige o header x-admin-token -----
    if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') {
      if (!isAdmin(req)) {
        const ip = req.socket.remoteAddress || 'unknown';
        if (!checkLoginRateLimit(ip)) {
          return sendJSON(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
        }
        return sendJSON(res, 401, { error: 'Não autorizado' });
      }

      if (pathname === '/api/admin/products' && req.method === 'GET') {
        return sendJSON(res, 200, readProducts());
      }

      if (pathname === '/api/admin/products' && req.method === 'POST') {
        const body = await readJSONBody(req, 2 * 1024 * 1024);
        if (!body.name || !CATEGORIES.includes(body.category) || body.price === undefined) {
          return sendJSON(res, 400, { error: 'Preencha nome, categoria e preço.' });
        }
        const base = {
          id: crypto.randomUUID(),
          name: '', category: 'camisetas', price: 0, originalPrice: null,
          sizes: [], badge: '', image: '', visible: true, createdAt: Date.now()
        };
        const product = sanitizeProductInput(body, base);
        const list = readProducts();
        list.unshift(product);
        writeProducts(list);
        return sendJSON(res, 201, product);
      }

      const productMatch = pathname.match(/^\/api\/admin\/products\/([a-zA-Z0-9-]+)$/);
      if (productMatch && req.method === 'PUT') {
        const id = productMatch[1];
        const list = readProducts();
        const idx = list.findIndex((p) => p.id === id);
        if (idx === -1) return sendJSON(res, 404, { error: 'Produto não encontrado' });
        const body = await readJSONBody(req, 2 * 1024 * 1024);
        list[idx] = sanitizeProductInput(body, list[idx]);
        writeProducts(list);
        return sendJSON(res, 200, list[idx]);
      }

      if (productMatch && req.method === 'DELETE') {
        const id = productMatch[1];
        const list = readProducts();
        const next = list.filter((p) => p.id !== id);
        if (next.length === list.length) return sendJSON(res, 404, { error: 'Produto não encontrado' });
        writeProducts(next);
        return sendJSON(res, 200, { ok: true });
      }

      if (pathname === '/api/admin/upload' && req.method === 'POST') {
        const body = await readJSONBody(req, 12 * 1024 * 1024);
        const url_ = saveUploadedImage(body.dataUrl);
        return sendJSON(res, 200, { url: url_ });
      }

      if (pathname === '/api/admin/orders' && req.method === 'GET') {
        return sendJSON(res, 200, readOrders());
      }

      const orderMatch = pathname.match(/^\/api\/admin\/orders\/([a-zA-Z0-9-]+)$/);
      if (orderMatch && req.method === 'PUT') {
        const id = orderMatch[1];
        const body = await readJSONBody(req, 4096);
        if (!ORDER_STATUSES.includes(body.status)) {
          return sendJSON(res, 400, { error: 'Status inválido' });
        }
        const list = readOrders();
        const idx = list.findIndex((o) => o.id === id);
        if (idx === -1) return sendJSON(res, 404, { error: 'Pedido não encontrado' });
        list[idx].status = body.status;
        writeOrders(list);
        return sendJSON(res, 200, list[idx]);
      }

      return sendJSON(res, 404, { error: 'Rota não encontrada' });
    }

    // ----- arquivos estáticos (loja, admin.html, imagens) -----
    if (req.method === 'GET') {
      return serveStatic(req, res, pathname);
    }

    sendJSON(res, 404, { error: 'Não encontrado' });
  } catch (err) {
    if (err.message === 'PAYLOAD_TOO_LARGE') {
      return sendJSON(res, 413, { error: 'Arquivo muito grande' });
    }
    console.error(err);
    sendJSON(res, 500, { error: err.message || 'Erro interno' });
  }
});

const isPublicHost = CONFIG.host !== '127.0.0.1' && CONFIG.host !== 'localhost';

if (isPublicHost && CONFIG.adminPassword === 'mudaressasenha123') {
  console.log('');
  console.log('  ⚠️  AVISO DE SEGURANÇA: o site está configurado para aceitar');
  console.log('  conexões de fora deste computador (host = ' + CONFIG.host + '), mas a senha');
  console.log('  do admin ainda é a padrão. Troque em config.json (ou na variável');
  console.log('  de ambiente F7_ADMIN_PASSWORD) antes de deixar o site no ar.');
  console.log('');
}

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log('');
  console.log('  F7 Grifes — servidor rodando');
  console.log('  Loja:  http://' + (isPublicHost ? CONFIG.host : 'localhost') + ':' + CONFIG.port);
  console.log('  Admin: http://' + (isPublicHost ? CONFIG.host : 'localhost') + ':' + CONFIG.port + '/admin');
  console.log(isPublicHost
    ? '  (aceitando conexões externas — use isso atrás de HTTPS/domínio, veja PUBLICAR.md)'
    : '  (só acessível neste computador)');
  console.log('');
});
