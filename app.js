// ==================== ESTADO ====================
let productos = JSON.parse(localStorage.getItem('productos')) || [];
let ventas = JSON.parse(localStorage.getItem('ventas')) || [];
let editandoId = null;

// ==================== UTILIDADES ====================
const guardarDatos = () => {
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

// ==================== TABS ====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ==================== RENDER: PRODUCTOS ====================
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

// ==================== RENDER: TABLA DE VENTAS ====================
function renderSaleProducts() {
  const tbody = document.getElementById('saleProductsBody');

  if (productos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No hay productos registrados</td></tr>';
    return;
  }

  tbody.innerHTML = productos.map(p => `
    <tr>
      <td><strong>#${p.id}</strong></td>
      <td>${escaparHTML(p.nombre)}</td>
      <td>${formatearPrecio(p.precioVenta)}</td>
      <td class="${p.stock <= 5 ? 'stock-bajo' : ''}">${p.stock}</td>
      <td class="text-right">
        <button class="action-btn sell-btn" onclick="venderProducto(${p.id})">Vender</button>
      </td>
    </tr>
  `).join('');
}

// ==================== RENDER: ESTADÍSTICAS ====================
function renderEstadisticas() {
  const totalStock = productos.reduce((s, p) => s + Number(p.stock), 0);
  const valorInventario = productos.reduce((s, p) => s + p.precioCompra * p.stock, 0);
  const ganancias = ventas.reduce((s, v) => s + v.ganancia, 0);

  document.getElementById('totalProductos').textContent = productos.length;
  document.getElementById('totalStock').textContent = totalStock;
  document.getElementById('valorInventario').textContent = formatearPrecio(valorInventario);
  document.getElementById('totalGanancias').textContent = formatearPrecio(ganancias);
}

// ==================== RENDER: LISTA BAJO STOCK ====================
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

// ==================== RENDER: ÚLTIMAS VENTAS ====================
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

// ==================== RENDER: HISTORIAL ====================
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

function renderTodo() {
  renderProductos(document.getElementById('searchInput').value);
  renderSaleProducts();
  renderEstadisticas();
  renderLowStock();
  renderRecentSales();
  renderHistorial();
  renderCategoryChips();
}

// ==================== CRUD PRODUCTOS ====================
document.getElementById('productForm').addEventListener('submit', (e) => {
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

  guardarDatos();
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

function eliminarProducto(id) {
  const p = productos.find(p => p.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;

  productos = productos.filter(p => p.id !== id);
  guardarDatos();
  renderTodo();
}

// ==================== VENTAS ====================
function venderProducto(id) {
  // Cambiar a la pestaña de ventas
  document.querySelector('.tab-btn[data-tab="ventas"]').click();
  document.getElementById('saleProductInput').value = id;
  document.getElementById('saleCantidad').value = 1;
  document.getElementById('saleProductInput').focus();
}

document.getElementById('saleForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const input = document.getElementById('saleProductInput').value.trim().toLowerCase();
  const cantidad = parseInt(document.getElementById('saleCantidad').value);

  if (!input || !cantidad || cantidad < 1) {
    mostrarMensaje('Completa todos los campos correctamente', 'error');
    return;
  }

  const producto = productos.find(p =>
    p.id.toString() === input || p.nombre.toLowerCase() === input
  );

  if (!producto) {
    mostrarMensaje('Producto no encontrado. Verifica el ID o nombre.', 'error');
    return;
  }

  if (producto.stock < cantidad) {
    mostrarMensaje(`Stock insuficiente. Solo hay ${producto.stock} unidades disponibles.`, 'error');
    return;
  }

  const total = producto.precioVenta * cantidad;
  const ganancia = (producto.precioVenta - producto.precioCompra) * cantidad;

  ventas.push({
    fecha: new Date().toLocaleString('es-AR'),
    producto: producto.nombre,
    productoId: producto.id,
    cantidad,
    total,
    ganancia
  });

  producto.stock -= cantidad;

  guardarDatos();
  renderTodo();

  document.getElementById('saleProductInput').value = '';
  document.getElementById('saleCantidad').value = 1;
  mostrarMensaje(`Venta registrada: ${cantidad} × ${producto.nombre} — Ganancia: ${formatearPrecio(ganancia)}`, 'success');
});

function mostrarMensaje(texto, tipo) {
  const msg = document.getElementById('saleMessage');
  msg.textContent = texto;
  msg.className = 'message ' + tipo;
  setTimeout(() => { msg.className = 'message'; }, 4000);
}

// ==================== BUSCADOR ====================
document.getElementById('searchInput').addEventListener('input', (e) => {
  renderProductos(e.target.value);
});

// ==================== HISTORIAL ====================
document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  if (!confirm('¿Borrar todo el historial de ventas? Las ganancias se reiniciarán.')) return;
  ventas = [];
  guardarDatos();
  renderTodo();
});

// ==================== INICIALIZACIÓN ====================
function init() {
  // Fecha en header
  const hoy = new Date();
  document.getElementById('headerDate').textContent = hoy.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  document.getElementById('currentYear').textContent = hoy.getFullYear();

  renderTodo();
}

// ==================== BUSCADOR DEL PANEL ====================
const panelSearchInput = document.getElementById('panelSearchInput');
const panelSearchClear = document.getElementById('panelSearchClear');
const searchResultsWrapper = document.getElementById('searchResultsWrapper');
const searchResults = document.getElementById('searchResults');
const searchResultsTitle = document.getElementById('searchResultsTitle');
const categoryChips = document.getElementById('categoryChips');

let filtroCategoriaActiva = null;

// Render de chips de categorías
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

  // Prefijo "Todas" + categorías
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

  // Listeners de chips
  categoryChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.categoria;
      filtroCategoriaActiva = cat === '' ? null : cat;
      renderCategoryChips();
      ejecutarBusquedaPanel();
    });
  });
}

// Buscar productos según texto y categoría activa
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

// Render de una tarjeta de resultado
function tarjetaResultado(p) {
  const margen = p.precioVenta - p.precioCompra;
  const margenClass = margen >= 0 ? 'margen-positivo' : 'margen-negativo';
  const stockClass = p.stock <= 5 ? 'stock-bajo' : '';

  return `
    <div class="result-card">
      <div class="result-header">
        <div class="result-name">${escaparHTML(p.nombre)}</div>
        <span class="result-id">#${p.id}</span>
      </div>
      ${p.categoria ? `<span class="result-category">${escaparHTML(p.categoria)}</span>` : ''}
      <div class="result-details">
        <div class="result-detail">
          <span class="result-detail-label">P. Compra</span>
          <span class="result-detail-value">${formatearPrecio(p.precioCompra)}</span>
        </div>
        <div class="result-detail">
          <span class="result-detail-label">P. Venta</span>
          <span class="result-detail-value">${formatearPrecio(p.precioVenta)}</span>
        </div>
        <div class="result-detail">
          <span class="result-detail-label">Margen</span>
          <span class="result-detail-value ${margenClass}">${formatearPrecio(margen)}</span>
        </div>
        <div class="result-detail">
          <span class="result-detail-label">Stock</span>
          <span class="result-detail-value ${stockClass}">${p.stock} u.</span>
        </div>
      </div>
      <div class="result-actions">
        <button class="action-btn sell-btn" onclick="venderProducto(${p.id})">Vender</button>
        <button class="action-btn edit-btn" onclick="irAEditarProducto(${p.id})">Editar</button>
      </div>
    </div>
  `;
}

// Ejecuta la búsqueda y renderiza resultados
function ejecutarBusquedaPanel() {
  const texto = panelSearchInput.value;
  const hayTexto = texto.trim() !== '';
  const hayCategoria = filtroCategoriaActiva !== null;

  // Mostrar/ocultar botón limpiar
  if (hayTexto) {
    panelSearchClear.classList.add('visible');
  } else {
    panelSearchClear.classList.remove('visible');
  }

  // Si no hay búsqueda ni categoría activa, ocultar resultados
  if (!hayTexto && !hayCategoria) {
    searchResultsWrapper.style.display = 'none';
    return;
  }

  const resultados = buscarProductos(texto, filtroCategoriaActiva);
  searchResultsWrapper.style.display = 'block';

  // Título
  const partes = [];
  if (hayTexto) partes.push(`"${escaparHTML(texto)}"`);
  if (hayCategoria) partes.push(`categoría "${escaparHTML(filtroCategoriaActiva)}"`);

  searchResultsTitle.textContent = 
    `${resultados.length} resultado${resultados.length !== 1 ? 's' : ''} ${partes.length ? 'para ' + partes.join(' en ') : ''}`;

  // Render
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

// Ir a la pestaña Productos y activar edición
function irAEditarProducto(id) {
  document.querySelector('.tab-btn[data-tab="productos"]').click();
  setTimeout(() => editarProducto(id), 100);
}

// Event listeners del buscador del panel
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

init();