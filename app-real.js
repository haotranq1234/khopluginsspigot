const $ = (id) => document.getElementById(id);
const config = window.SUPABASE_CONFIG || {};
let client = window.supabase?.createClient(config.url, config.anonKey);
let plugins = [], currentPage = 1, pageSize = 8, authMode = 'login', currentUser = null;

const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const priceLabel = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;
const tagLabel = (tag) => tag === 'premium' ? '<span class="tag premium">Premium</span>' : '<span class="tag">Miễn phí</span>';
const filtered = () => {
  const query = $('searchInput').value.trim().toLowerCase();
  const platform = $('platformFilter').value;
  const tag = $('tagFilter').value;
  return plugins.filter((plugin) => (!query || plugin.name.toLowerCase().includes(query)) && (platform === 'all' || plugin.platform.toLowerCase() === platform) && (tag === 'all' || plugin.tag === tag));
};

function render() {
  const list = filtered();
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  if (currentPage > pages) currentPage = pages;
  const start = (currentPage - 1) * pageSize;
  const shown = list.slice(start, start + pageSize);
  $('pluginRows').innerHTML = shown.map((plugin) => `<tr>
    <td><div class="plugin-title"><span class="plugin-logo">${initials(plugin.name)}</span><span>${plugin.name}</span>${tagLabel(plugin.tag)}</div></td>
    <td>${plugin.platform}</td><td><span class="version-count">${plugin.versions}</span></td><td><span class="price">${priceLabel(plugin.price)}</span></td>
    <td><span class="state ${plugin.status === 'draft' ? 'draft' : ''}"><span>●</span>&nbsp;${plugin.status === 'draft' ? 'Bản nháp' : 'Hoạt động'}</span></td>
    <td><div class="row-actions"><button class="row-button version-btn" data-id="${plugin.id}">＋ Phiên bản</button><button class="row-button delete-btn" data-id="${plugin.id}" data-name="${plugin.name}">Xóa</button></div></td>
  </tr>`).join('');
  $('emptyState').hidden = shown.length > 0;
  $('resultLabel').textContent = `${list.length} plugin`;
  $('paginationLabel').textContent = list.length ? `Hiển thị ${start + 1}–${Math.min(start + pageSize, list.length)} trong ${list.length} plugin` : 'Không có kết quả';
  $('totalPlugins').textContent = plugins.length;
  $('navPluginCount').textContent = plugins.length;
  $('totalVersions').textContent = plugins.reduce((total, plugin) => total + plugin.versions, 0);
  $('pageButtons').innerHTML = Array.from({ length: pages }, (_, index) => `<button class="page-button ${index + 1 === currentPage ? 'current' : ''}" data-page="${index + 1}">${index + 1}</button>`).join('');
  document.querySelectorAll('[data-page]').forEach((button) => { button.onclick = () => { currentPage = Number(button.dataset.page); render(); }; });
  document.querySelectorAll('.version-btn').forEach((button) => { button.onclick = () => openModal('version', button.dataset.id); });
  document.querySelectorAll('.delete-btn').forEach((button) => { button.onclick = () => deletePlugin(button.dataset.id, button.dataset.name); });
}

async function loadPlugins() {
  const { data, error } = await client.from('plugins').select('id,name,platform,price,tag,status,plugin_versions(id)').order('created_at', { ascending: false });
  if (error) return showAuthError(`Không tải được plugin: ${error.message}`);
  plugins = (data || []).map((plugin) => ({ ...plugin, versions: plugin.plugin_versions?.length || 0 }));
  render();
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.authMode === mode));
  $('authTitle').textContent = mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
  $('authSubtitle').textContent = mode === 'login' ? 'Đăng nhập để quản lý kho plugin của bạn.' : 'Tạo tài khoản để bắt đầu quản lý kho.';
  $('authSubmit').textContent = mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
  $('nameField').hidden = mode === 'login'; $('confirmField').hidden = mode === 'login';
  $('authName').required = mode === 'register'; $('authConfirm').required = mode === 'register'; showAuthError('');
}
function showAuthError(message) { $('authError').textContent = message || ''; }
function showApp(user) { currentUser = user; $('authScreen').hidden = true; $('appShell').hidden = false; $('userAvatar').textContent = initials(user.user_metadata?.name || user.email || 'AD'); loadPlugins(); }
function showLogin() { currentUser = null; $('authScreen').hidden = false; $('appShell').hidden = true; $('authForm').reset(); setAuthMode('login'); }
function openModal(mode = 'plugin', id = '') { $('modalBackdrop').hidden = false; $('pluginForm').reset(); $('pluginForm').dataset.mode = mode; $('pluginForm').dataset.id = id; $('modalTitle').textContent = mode === 'version' ? 'Thêm phiên bản mới' : 'Thêm plugin mới'; $('modalDescription').textContent = mode === 'version' ? 'Thêm phiên bản cho plugin đang chọn.' : 'Tạo plugin mới để bắt đầu quản lý các phiên bản.'; $('pluginName').disabled = mode === 'version'; if (mode === 'version') $('pluginName').value = plugins.find((plugin) => plugin.id === id)?.name || ''; $('pluginName').focus(); }
function closeModal() { $('modalBackdrop').hidden = true; $('pluginName').disabled = false; }
function showToast(message) { $('toast').textContent = `✓  ${message}`; $('toast').classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2500); }

async function deletePlugin(id, name) {
  if (!window.confirm(`Bạn có chắc muốn xóa plugin “${name}” không?`)) return;
  const { error } = await client.from('plugins').delete().eq('id', id);
  if (error) return showAuthError(`Không xóa được plugin: ${error.message}`);
  showToast(`Đã xóa plugin “${name}”`); await loadPlugins();
}

document.querySelectorAll('.auth-tab').forEach((tab) => { tab.onclick = () => setAuthMode(tab.dataset.authMode); });
document.querySelectorAll('#searchInput,#platformFilter,#tagFilter').forEach((element) => element.addEventListener('input', () => { currentPage = 1; render(); }));
$('pageSize').onchange = (event) => { pageSize = Number(event.target.value); currentPage = 1; render(); };
$('addPluginBtn').onclick = () => openModal(); $('closeModal').onclick = closeModal; $('cancelModal').onclick = closeModal;
$('modalBackdrop').onclick = (event) => { if (event.target === event.currentTarget) closeModal(); };
$('refreshBtn').onclick = () => { loadPlugins(); showToast('Danh sách đã được làm mới'); };
$('logoutBtn').onclick = async () => { await client.auth.signOut({ scope: 'global' }); showLogin(); showToast('Đã đăng xuất'); };
document.addEventListener('keydown', (event) => { if (event.key === '/' && document.activeElement.tagName !== 'INPUT') { event.preventDefault(); $('searchInput').focus(); } if (event.key === 'Escape') closeModal(); });

$('authForm').onsubmit = async (event) => {
  event.preventDefault(); showAuthError('');
  if (!client || !config.anonKey || config.anonKey.includes('PASTE_')) return showAuthError('Website chưa được cấu hình Supabase anon key trên Vercel.');
  const email = $('authEmail').value.trim().toLowerCase(), password = $('authPassword').value;
  if (authMode === 'register') {
    if (password !== $('authConfirm').value) return showAuthError('Mật khẩu xác nhận không khớp.');
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { name: $('authName').value.trim() } } });
    if (error) return showAuthError(error.message);
    if (data.session) showApp(data.session.user); else showAuthError('Đăng ký thành công. Hãy kiểm tra email để xác nhận tài khoản.');
  } else {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return showAuthError('Email hoặc mật khẩu không đúng.');
    showApp(data.user); showToast('Đăng nhập thành công');
  }
};

$('pluginForm').onsubmit = async (event) => {
  event.preventDefault(); const form = event.currentTarget;
  const pluginId = form.dataset.id;
  if (form.dataset.mode === 'version') {
    const { error } = await client.from('plugin_versions').insert({ plugin_id: pluginId, version: $('pluginVersion').value.trim(), created_by: currentUser.id });
    if (error) return showAuthError(error.message);
    showToast('Đã thêm phiên bản mới');
  } else {
    const { data: plugin, error } = await client.from('plugins').insert({ name: $('pluginName').value.trim(), platform: $('pluginPlatform').value, price: Number($('pluginPrice').value || 0), tag: $('pluginTag').value, created_by: currentUser.id }).select('id').single();
    if (error) return showAuthError(error.message);
    const { error: versionError } = await client.from('plugin_versions').insert({ plugin_id: plugin.id, version: $('pluginVersion').value.trim(), created_by: currentUser.id });
    if (versionError) return showAuthError(versionError.message);
    showToast('Đã tạo plugin mới');
  }
  closeModal(); currentPage = 1; await loadPlugins();
};

async function bootstrap() {
  if (config.anonKey?.includes('PASTE_')) {
    try {
      const response = await fetch('/api/config');
      const runtimeConfig = await response.json();
      Object.assign(config, runtimeConfig);
    } catch (error) { /* Vercel config will show a helpful message in the login form. */ }
  }
  client = window.supabase?.createClient(config.url, config.anonKey);
  if (client) { client.auth.onAuthStateChange((_event, session) => session ? showApp(session.user) : showLogin()); client.auth.getSession().then(({ data }) => data.session ? showApp(data.session.user) : showLogin()); } else showLogin();
}
bootstrap();
function syncProfileVisual() {
  if (!currentUser) return;
  const name = currentUser.user_metadata?.name || currentUser.email || 'AD';
  const initialsText = initials(name);
  $('profileBtn').textContent = initialsText;
  $('profileAvatar').textContent = initialsText;
  $('profileName').value = currentUser.user_metadata?.name || '';
  $('profileEmail').value = currentUser.email || '';
}
function openProfile() { syncProfileVisual(); $('profileBackdrop').hidden = false; $('profileName').focus(); }
function closeProfile() { $('profileBackdrop').hidden = true; }
$('profileBtn').onclick = openProfile;
$('closeProfile').onclick = closeProfile;
$('profileBackdrop').onclick = (event) => { if (event.target === event.currentTarget) closeProfile(); };
$('profileLogout').onclick = async () => { const { error } = await client.auth.signOut({ scope: 'global' }); closeProfile(); showLogin(); if (error) return showAuthError(error.message); showToast('Đã đăng xuất'); };
$('profileEmail').parentElement.insertAdjacentHTML('afterend', '<label>Mật khẩu mới<input id="profilePassword" type="password" minlength="6" placeholder="Để trống nếu không đổi" /></label><label>Xác nhận mật khẩu mới<input id="profilePasswordConfirm" type="password" minlength="6" placeholder="Nhập lại mật khẩu mới" /></label>');
$('profileForm').onsubmit = async (event) => {
  event.preventDefault();
  const name = $('profileName').value.trim();
  const newPassword = $('profilePassword').value;
  if (newPassword && newPassword !== $('profilePasswordConfirm').value) return showAuthError('Mật khẩu mới xác nhận không khớp.');
  const updatePayload = { data: { name } };
  if (newPassword) updatePayload.password = newPassword;
  const { error: authError } = await client.auth.updateUser(updatePayload);
  if (authError) return showAuthError(authError.message);
  const { error: profileError } = await client.from('profiles').update({ name }).eq('id', currentUser.id);
  if (profileError) return showAuthError(profileError.message);
  currentUser = { ...currentUser, user_metadata: { ...currentUser.user_metadata, name } };
  $('profilePassword').value = ''; $('profilePasswordConfirm').value = '';
  syncProfileVisual(); closeProfile(); showToast(newPassword ? 'Đã cập nhật tên và mật khẩu' : 'Đã cập nhật tên');
};
