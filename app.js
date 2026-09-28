// ============================================================
// CONFIGURACIÓN GOOGLE
// ============================================================
const GOOGLE_CLIENT_ID = '26724113942-m7d4lr66jaj4t0nncd0vup7rp6pke4f9.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_FILE_NAME = 'libreria-datos.json';

let googleAccessToken = null;
let googleTokenClient = null;
let driveFileId = null; // ID del archivo en Drive (cache)

// ============================================================
// ESTADO
// ============================================================
let productos = JSON.parse(localStorage.getItem('productos')) || [];
let ventas = JSON.parse(localStorage.getItem('ventas')) || [];
let carrito = [];
let editandoId = null;
let filtroCategoriaActiva = null;

// ============================================================
// UTILIDADES
// ============================================================
const guardarDatosLocal = () => {
  localStorage.setItem('productos', JSON.stringify(productos));
  localStorage.setItem('ventas', JSON.stringify(ventas));
};

const formatearPrecio = (n) =>
  '$' + Number(n).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const generarId = () => {
  if (productos.length === 0) return 1;
  return Math.max(...productos.map(p => p.id)) + 1;
};

const escaparHTML = (str) => {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
};

// Guardar todo (local + Drive si hay sesión)
async function guardarTodo() {
  guardarDatosLocal();
  if (googleAccessToken) {
    await subirADrive();
  }
}

// ============================================================
// GOOGLE DRIVE API (sin librerías externas)
// ============================================================
async function subirADrive() {
  if (!googleAccessToken) return;

  const contenido = JSON.stringify({ productos, ventas });

  try {
    // Si no tenemos el fileId, buscarlo
    if (!driveFileId) {
      driveFileId = await buscarArchivoDrive();
    }

    if (driveFileId) {
      // Actualizar archivo existente
      await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: contenido
        }
      );
    } else {
      // Crear archivo nuevo
      const metadata = {
        name: DRIVE_FILE_NAME,
        parents: ['appDataFolder']
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([contenido], { type: 'application/json' }));

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${googleAccessToken}` },
          body: form
        }
      );
      const data = await res.json();
      driveFileId = data.id;
    }
  } catch (e) {
    console.error('Error subiendo a Drive:', e);
  }
}

async function buscarArchivoDrive() {
  if (!googleAccessToken) return null;

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${googleAccessToken}` } }
    );
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  } catch (e) {
    console.error('Error buscando archivo:', e);
  }
  return null;
}

async function descargarDeDrive() {
  if (!googleAccessToken) return false;

  try {
    const fileId = await buscarArchivoDrive();
    if (!fileId) {
      driveFileId = null;
      return false;
    }

    driveFileId = fileId;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${googleAccessToken}` } }
    );
    const datos = await res.json();

    productos = datos.productos || [];
    ventas = datos.ventas || [];
    guardarDatosLocal();
    return true;
  } catch (e) {
    console.error('Error descargando de Drive:', e);
    return false;
  }
}

// ============================================================
// INICIALIZACIÓN GOOGLE AUTH
// ============================================================
function initGoogleAuth() {
  if (typeof google === 'undefined' || !google.accounts) {
    // Reintentar cuando cargue la librería
    setTimeout(initGoogleAuth, 300);
    return;
  }

  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: async (response) => {
      if (response.error) {
        console.error('Error de autorización:', response.error);
        return;
      }
      googleAccessToken = response.access_token;

      // Obtener información del usuario
      try {
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        }).then(r => r.json());

        document.getElementById('headerUser').style.display = 'flex';
        document.getElementById('googleSignInBtn').style.display = 'none';
        document.getElementById('userEmail').textContent = userInfo.email || 'Usuario';
      } catch (e) {
        console.error('Error obteniendo usuario:', e);
      }

      // Descargar datos desde Drive
      const ok = await descargarDeDrive();
      if (ok) {
        renderTodo();
        mostrarMensajeGlobal('Datos sincronizados desde Google Drive');
      } else {
        // Primera vez: subir los datos locales
        await subirADrive();
      }
    }
  });

  // Mostrar botón si no hay sesión
  if (!googleAccessToken) {
    document.getElementById('googleSignInBtn').style.display = 'inline-flex';
  }
}

// Botón iniciar sesión
document.getElementById('googleSignInBtn').addEventListener('click', () => {
  if (googleTokenClient) {
    googleTokenClient.requestAccessToken({ prompt: '' });
  } else {
    alert('Google aún se está cargando, espera un momento e intenta de nuevo.');
  }
});

// Botón cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
  if (googleAccessToken && google.accounts) {
    google.accounts.oauth2.revoke(googleAccessToken);
  }
  googleAccessToken = null;
  driveFileId = null;
  document.getElementById('headerUser').style.display = 'none';
  document.getElementById('googleSignInBtn').style.display = 'inline-flex';
  renderTodo();
});

function mostrarMensajeGlobal(texto) {
  console.log('[Sistema]', texto);
}

// ============================================================
// TABS
// ============================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ============================================================
// RENDER: PRODUCTOS (tabla)
// ============================================================
function renderProductos(filtro = '') {
  const tbody = document.getElementById('productTableBody');
  const texto = filtro.toLowerCase().trim();

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(texto) ||
    p.id.toString() === texto ||
    (p.categoria || '').toLowerCase().includes(texto)
  );

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">
      ${filtro ? 'No se encontraron productos' : 'No hay productos registrados'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(p => {
    const margen = p.precioVenta - p.precioCompra;
    const margenClass = margen >= 0 ? 'margen-positivo' : 'margen-negativo';
    const stockClass = p.stock <= 5 ? 'stock-bajo' : '';

    return `
      <tr>
        <td><strong>#${p.id}</strong></td>
        <td>${escaparHTML(p.nombre)}</td>
        <td>${escaparHTML(p.categoria) || '—'}</td>
        <td>${formatearPrecio(p.precioCompra)}</td>
        <td>${formatearPrecio(p.precioVenta)}</td>
        <td class="${margenClass}">${formatearPrecio(margen)}</td>
        <td class="${stockClass}">${p.stock}</td>
        <td class="text-right">
          <button class="action-btn sell-btn" onclick="venderProducto(${p.id})">Vender</button>
          <button class="action-btn edit-btn" onclick="editarProducto(${p.id})">Editar</button>
          <button class="action-btn delete-btn" onclick="eliminarProducto(${p.id})">Eliminar</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================
// RENDER: ESTADÍSTICAS
// ============================================================
function renderEstadisticas() {
  const totalStock = productos.reduce((s, p) => s + Number(p.stock), 0);
  const valorInventario = productos.reduce((s, p) => s + p.precioCompra * p.stock, 0);
  const ganancias = ventas.reduce((s, v) => s + v.ganancia, 0);

  document.getElementById('totalProductos').textContent = productos.length;
  document.getElementById('totalStock').textContent = totalStock;
  document.getElementById('valorInventario').textContent = formatearPrecio(valorInventario);
  document.getElementById('totalGanancias').textContent = formatearPrecio(ganancias);
}

// ============================================================
// RENDER: LISTA BAJO STOCK
// ============================================================
function renderLowStock() {
  const cont = document.getElementById('lowStockList');
  const bajos = productos.filter(p => p.stock <= 5).sort((a, b) => a.stock - b.stock);

  if (bajos.length === 0) {
    cont.innerHTML = '<p class="empty-msg">Sin alertas de stock</p>';
    return;
  }

  cont.innerHTML = bajos.slice(0, 6).map(p => `
    <div class="list-item">
      <span class="list-item-name">${escaparHTML(p.nombre)}</span>
      <span class="list-item-value danger">${p.stock} unidades</span>
    </div>
  `).join('');
}

// ============================================================
// RENDER: ÚLTIMAS VENTAS
// ============================================================
function renderRecentSales() {
  const cont = document.getElementById('recentSalesList');
  const ultimas = ventas.slice(-5).reverse();

  if (ultimas.length === 0) {
    cont.innerHTML = '<p class="empty-msg">Sin ventas recientes</p>';
    return;
  }

  cont.innerHTML = ultimas.map(v => `
    <div class="list-item">
      <span class="list-item-name">${escaparHTML(v.producto)} <small style="color:var(--text-muted)">×${v.cantidad}</small></span>
      <span class="list-item-value success">+${formatearPrecio(v.ganancia)}</span>
    </div>
  `).join('');
}

// ============================================================
// RENDER: HISTORIAL
// ============================================================
function renderHistorial() {
  const tbody = document.getElementById('historyTableBody');

  if (ventas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Sin ventas registradas</td></tr>';
    return;
  }

  tbody.innerHTML = ventas.slice().reverse().map(v => `
    <tr>
      <td>${v.fecha}</td>
      <td>${escaparHTML(v.producto)}</td>
      <td>${v.cantidad}</td>
      <td>${formatearPrecio(v.total)}</td>
      <td class="margen-positivo">${formatearPrecio(v.ganancia)}</td>
    </tr>
  `).join('');
}

// ============================================================
// RENDER: RESUMEN MENSUAL
// ============================================================
function renderResumenMensual() {
  const ahora = new Date();
  const mesActual = ahora.getMonth();
  const anioActual = ahora.getFullYear();

  const ventasMes = ventas.filter(v => {
    const fecha = new Date(v.fechaOriginal || v.fecha);
    return fecha.getMonth() === mesActual && fecha.getFullYear() === anioActual;
  });

  const semanas = [0, 0, 0, 0];

  ventasMes.forEach(v => {
    const fecha = new Date(v.fechaOriginal || v.fecha);
    const dia = fecha.getDate();
    const semana = Math.min(Math.floor((dia - 1) / 7), 3);
    semanas[semana] += v.total;
  });

  const totalMes = semanas.reduce((a, b) => a + b, 0);

  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`week${i + 1}Total`);
    if (el) el.textContent = formatearPrecio(semanas[i]);
  }

  const monthEl = document.getElementById('monthTotal');
  if (monthEl) monthEl.textContent = formatearPrecio(totalMes);
}

// ============================================================
// RENDER: CARRITO
// ============================================================
function renderCarrito() {
  const tbody = document.getElementById('cartBody');

  if (carrito.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Carrito vacío</td></tr>';
    document.getElementById('cartTotal').textContent = '$0';
    return;
  }

  tbody.innerHTML = carrito.map((item, index) => `
    <tr>
      <td>${escaparHTML(item.nombre)}</td>
      <td>${formatearPrecio(item.precioVenta)}</td>
      <td>${item.cantidad}</td>
      <td>${formatearPrecio(item.precioVenta * item.cantidad)}</td>
      <td class="text-right">
        <button class="action-btn delete-btn" onclick="eliminarDelCarrito(${index})">Eliminar</button>
      </td>
    </tr>
  `).join('');

  const total = carrito.reduce((sum, item) => sum + (item.precioVenta * item.cantidad), 0);
  document.getElementById('cartTotal').textContent = formatearPrecio(total);
}

// ============================================================
// RENDER GENERAL
// ============================================================
function renderTodo() {
  renderProductos(document.getElementById('searchInput').value);
  renderEstadisticas();
  renderLowStock();
  renderRecentSales();
  renderHistorial();
  renderResumenMensual();
  renderCategoryChips();
  renderCarrito();
}

// ============================================================
// CRUD PRODUCTOS
// ============================================================
document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = document.getElementById('nombre').value.trim();
  const precioCompra = parseFloat(document.getElementById('precioCompra').value);
  const precioVenta = parseFloat(document.getElementById('precioVenta').value);
  const stock = parseInt(document.getElementById('stock').value);
  const categoria = document.getElementById('categoria').value.trim();

  if (precioVenta < precioCompra) {
    if (!confirm('El precio de venta es menor al de compra. ¿Deseas continuar?')) return;
  }

  if (editandoId !== null) {
    const p = productos.find(p => p.id === editandoId);
    p.nombre = nombre;
    p.precioCompra = precioCompra;
    p.precioVenta = precioVenta;
    p.stock = stock;
    p.categoria = categoria;
    cancelarEdicion();
  } else {
    productos.push({
      id: generarId(),
      nombre,
      precioCompra,
      precioVenta,
      stock,
      categoria,
      fechaCreacion: new Date().toISOString()
    });
  }

  await guardarTodo();
  renderTodo();
  e.target.reset();
});

function editarProducto(id) {
  const p = productos.find(p => p.id === id);
  if (!p) return;

  editandoId = id;
  document.getElementById('nombre').value = p.nombre;
  document.getElementById('precioCompra').value = p.precioCompra;
  document.getElementById('precioVenta').value = p.precioVenta;
  document.getElementById('stock').value = p.stock;
  document.getElementById('categoria').value = p.categoria || '';

  document.getElementById('formTitle').textContent = 'Editar Producto #' + id;
  document.getElementById('submitBtn').textContent = 'Guardar Cambios';
  document.getElementById('cancelBtn').style.display = 'inline-flex';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
  editandoId = null;
  document.getElementById('productForm').reset();
  document.getElementById('formTitle').textContent = 'Agregar Nuevo Producto';
  document.getElementById('submitBtn').textContent = 'Agregar Producto';
  document.getElementById('cancelBtn').style.display = 'none';
}

document.getElementById('cancelBtn').addEventListener('click', cancelarEdicion);

async function eliminarProducto(id) {
  const p = productos.find(p => p.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;

  productos = productos.filter(p => p.id !== id);
  await guardarTodo();
  renderTodo();
}

// ============================================================
// CARRITO
// ============================================================
function agregarAlCarrito() {
  const input = document.getElementById('saleProductInput').value.trim().toLowerCase();
  const cantidad = parseInt(document.getElementById('saleCantidad').value);

  if (!input || !cantidad || cantidad < 1) {
    mostrarMensaje('Completa todos los campos', 'error');
    return;
  }

  const producto = productos.find(p =>
    p.id.toString() === input || p.nombre.toLowerCase() === input
  );

  if (!producto) {
    mostrarMensaje('Producto no encontrado', 'error');
    return;
  }

  const enCarrito = carrito.filter(i => i.id === producto.id)
    .reduce((sum, i) => sum + i.cantidad, 0);

  if (producto.stock < enCarrito + cantidad) {
    mostrarMensaje(`Stock insuficiente. Disponible: ${producto.stock - enCarrito}`, 'error');
    return;
  }

  const existente = carrito.find(i => i.id === producto.id);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precioVenta: producto.precioVenta,
      precioCompra: producto.precioCompra,
      cantidad
    });
  }

  document.getElementById('saleProductInput').value = '';
  document.getElementById('saleCantidad').value = 1;
  renderCarrito();
  mostrarMensaje(`Agregado: ${producto.nombre} ×${cantidad}`, 'success');
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  renderCarrito();
}

document.getElementById('addToCartBtn').addEventListener('click', agregarAlCarrito);

document.getElementById('clearCartBtn').addEventListener('click', () => {
  carrito = [];
  renderCarrito();
});

document.getElementById('confirmSaleBtn').addEventListener('click', async () => {
  if (carrito.length === 0) {
    mostrarMensaje('El carrito está vacío', 'error');
    return;
  }

  for (const item of carrito) {
    const producto = productos.find(p => p.id === item.id);
    if (producto.stock < item.cantidad) {
      mostrarMensaje(`Stock insuficiente para ${item.nombre}`, 'error');
      return;
    }
  }

  const fecha = new Date();
  let gananciaTotal = 0;
  let totalVenta = 0;

  carrito.forEach(item => {
    const producto = productos.find(p => p.id === item.id);
    const total = item.precioVenta * item.cantidad;
    const ganancia = (item.precioVenta - item.precioCompra) * item.cantidad;

    ventas.push({
      fecha: fecha.toLocaleString('es-AR'),
      fechaOriginal: fecha.toISOString(),
      producto: item.nombre,
      productoId: item.id,
      cantidad: item.cantidad,
      total,
      ganancia
    });

    producto.stock -= item.cantidad;
    gananciaTotal += ganancia;
    totalVenta += total;
  });

  await guardarTodo();
  carrito = [];
  renderCarrito();
  renderTodo();
  mostrarMensaje(`Venta confirmada. Total: ${formatearPrecio(totalVenta)} — Ganancia: ${formatearPrecio(gananciaTotal)}`, 'success');
});

function mostrarMensaje(texto, tipo) {
  const msg = document.getElementById('saleMessage');
  msg.textContent = texto;
  msg.className = 'message ' + tipo;
  setTimeout(() => { msg.className = 'message'; }, 4000);
}

// ============================================================
// VENDER DESDE OTRAS PESTAÑAS
// ============================================================
function venderProducto(id) {
  document.querySelector('.tab-btn[data-tab="ventas"]').click();
  document.getElementById('saleProductInput').value = id;
  document.getElementById('saleCantidad').value = 1;
  setTimeout(() => document.getElementById('saleProductInput').focus(), 100);
}

function irAEditarProducto(id) {
  document.querySelector('.tab-btn[data-tab="productos"]').click();
  setTimeout(() => editarProducto(id), 100);
}

// ============================================================
// BUSCADOR DEL PANEL
// ============================================================
const panelSearchInput = document.getElementById('panelSearchInput');
const panelSearchClear = document.getElementById('panelSearchClear');
const searchResultsWrapper = document.getElementById('searchResultsWrapper');
const searchResults = document.getElementById('searchResults');
const searchResultsTitle = document.getElementById('searchResultsTitle');
const categoryChips = document.getElementById('categoryChips');

function renderCategoryChips() {
  const categorias = [...new Set(
    productos
      .map(p => (p.categoria || '').trim())
      .filter(c => c !== '')
  )].sort();

  if (categorias.length === 0) {
    categoryChips.innerHTML = '';
    return;
  }

  const todasActivo = filtroCategoriaActiva === null ? 'active' : '';
  let html = `
    <button class="chip ${todasActivo}" data-categoria="">
      Todas <span class="chip-count">${productos.length}</span>
    </button>
  `;

  html += categorias.map(cat => {
    const count = productos.filter(p => (p.categoria || '').trim() === cat).length;
    const activo = filtroCategoriaActiva === cat ? 'active' : '';
    return `
      <button class="chip ${activo}" data-categoria="${escaparHTML(cat)}">
        ${escaparHTML(cat)} <span class="chip-count">${count}</span>
      </button>
    `;
  }).join('');

  categoryChips.innerHTML = html;

  categoryChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.categoria;
      filtroCategoriaActiva = cat === '' ? null : cat;
      renderCategoryChips();
      ejecutarBusquedaPanel();
    });
  });
}

function buscarProductos(texto, categoria) {
  const t = texto.toLowerCase().trim();
  return productos.filter(p => {
    const coincideTexto = t === '' ||
      p.nombre.toLowerCase().includes(t) ||
      p.id.toString() === t ||
      p.id.toString().includes(t) ||
      (p.categoria || '').toLowerCase().includes(t);

    const coincideCategoria = !categoria ||
      (p.categoria || '').trim() === categoria;

    return coincideTexto && coincideCategoria;
  });
}

function tarjetaResultado(p) {
  const margen = p.precioVenta - p.precioCompra;
  const margenClass = margen >= 0 ? 'margen-positivo' : 'margen-negativo';
  const stockClass = p.stock <= 5 ? 'stock-bajo' : '';

  const vendidas = ventas
    .filter(v => v.productoId === p.id)
    .reduce((sum, v) => sum + v.cantidad, 0);

  const totalDisponible = vendidas + p.stock;
  const porcentajeVenta = totalDisponible > 0
    ? Math.round((vendidas / totalDisponible) * 100)
    : 0;

  const hitos = [30, 50, 70, 80, 90, 100];
  const hitosHTML = hitos.map(h => {
    const alcanzado = porcentajeVenta >= h;
    return `<span class="hito ${alcanzado ? 'alcanzado' : ''}">${h}%</span>`;
  }).join('');

  return `
    <div class="result-card">
      <div class="result-header">
        <div class="result-name">${escaparHTML(p.nombre)}</div>
        <span class="result-id">#${p.id}</span>
      </div>
      ${p.categoria ? `<span class="result-category">${escaparHTML(p.categoria)}</span>` : ''}
      <div class="result-details">
        <div class="result-detail">
          <span class="result-detail-label">P. Venta</span>
          <span class="result-detail-value">${formatearPrecio(p.precioVenta)}</span>
        </div>
        <div class="result-detail">
          <span class="result-detail-label">Stock</span>
          <span class="result-detail-value ${stockClass}">${p.stock} u.</span>
        </div>
        <div class="result-detail">
          <span class="result-detail-label">Vendidas</span>
          <span class="result-detail-value">${vendidas} u.</span>
        </div>
        <div class="result-detail">
          <span class="result-detail-label">% Venta</span>
          <span class="result-detail-value">${porcentajeVenta}%</span>
        </div>
      </div>
      <div class="hitos-container">
        <div class="hitos-label">Progreso de venta:</div>
        <div class="hitos">${hitosHTML}</div>
      </div>
      <div class="result-actions">
        <button class="action-btn sell-btn" onclick="venderProducto(${p.id})">Vender</button>
        <button class="action-btn edit-btn" onclick="irAEditarProducto(${p.id})">Editar</button>
      </div>
    </div>
  `;
}

function ejecutarBusquedaPanel() {
  const texto = panelSearchInput.value;
  const hayTexto = texto.trim() !== '';
  const hayCategoria = filtroCategoriaActiva !== null;

  if (hayTexto) {
    panelSearchClear.classList.add('visible');
  } else {
    panelSearchClear.classList.remove('visible');
  }

  if (!hayTexto && !hayCategoria) {
    searchResultsWrapper.style.display = 'none';
    return;
  }

  const resultados = buscarProductos(texto, filtroCategoriaActiva);
  searchResultsWrapper.style.display = 'block';

  const partes = [];
  if (hayTexto) partes.push(`"${escaparHTML(texto)}"`);
  if (hayCategoria) partes.push(`categoría "${escaparHTML(filtroCategoriaActiva)}"`);

  searchResultsTitle.textContent =
    `${resultados.length} resultado${resultados.length !== 1 ? 's' : ''} ${partes.length ? 'para ' + partes.join(' en ') : ''}`;

  if (resultados.length === 0) {
    searchResults.innerHTML = `
      <div class="search-empty" style="grid-column: 1 / -1;">
        <span class="search-empty-icon">⌕</span>
        <div class="search-empty-title">Sin resultados</div>
        <div class="search-empty-text">No se encontraron productos que coincidan con tu búsqueda.</div>
      </div>
    `;
  } else {
    searchResults.innerHTML = resultados.map(tarjetaResultado).join('');
  }
}

panelSearchInput.addEventListener('input', ejecutarBusquedaPanel);
panelSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    panelSearchInput.value = '';
    filtroCategoriaActiva = null;
    renderCategoryChips();
    ejecutarBusquedaPanel();
  }
});

panelSearchClear.addEventListener('click', () => {
  panelSearchInput.value = '';
  filtroCategoriaActiva = null;
  renderCategoryChips();
  panelSearchInput.focus();
  ejecutarBusquedaPanel();
});

document.getElementById('clearSearchBtn').addEventListener('click', () => {
  panelSearchInput.value = '';
  filtroCategoriaActiva = null;
  renderCategoryChips();
  ejecutarBusquedaPanel();
});

// ============================================================
// BUSCADOR DE PRODUCTOS
// ============================================================
document.getElementById('searchInput').addEventListener('input', (e) => {
  renderProductos(e.target.value);
});

// ============================================================
// HISTORIAL
// ============================================================
document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
  if (!confirm('¿Borrar todo el historial de ventas? Las ganancias se reiniciarán.')) return;
  ventas = [];
  await guardarTodo();
  renderTodo();
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
function init() {
  const hoy = new Date();
  document.getElementById('headerDate').textContent = hoy.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  document.getElementById('currentYear').textContent = hoy.getFullYear();

  renderTodo();

  // Iniciar Google Auth
  initGoogleAuth();
}

init();