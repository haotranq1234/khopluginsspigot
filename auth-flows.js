let pendingSignupEmail = '';

const authExtras = document.createElement('div');
authExtras.innerHTML = `
  <button type="button" class="forgot-link" id="forgotPasswordBtn">Quên mật khẩu?</button>
  <form id="verifyForm" class="auth-secondary-form" hidden>
    <div class="auth-form-icon">✉</div><h3>Xác minh email</h3><p>Mã xác minh 6 số đã được gửi đến <strong id="verifyEmail"></strong>.</p>
    <label>Mã xác minh<input id="verifyCode" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required placeholder="123456" /></label>
    <button class="primary-button auth-submit" type="submit">Xác minh và đăng ký</button><button type="button" class="text-button" id="resendCode">Gửi lại mã</button><button type="button" class="text-button" id="backToAuth">Quay lại</button>
  </form>
  <form id="forgotForm" class="auth-secondary-form" hidden>
    <div class="auth-form-icon">↗</div><h3>Khôi phục mật khẩu</h3><p>Nhập Gmail, chúng tôi sẽ gửi link để bạn đặt mật khẩu mới.</p>
    <label>Email<input id="forgotEmail" type="email" required placeholder="admin@example.com" /></label>
    <button class="primary-button auth-submit" type="submit">Gửi link khôi phục</button><button type="button" class="text-button" id="backFromForgot">Quay về trang đăng nhập</button>
  </form>
  <form id="resetForm" class="auth-secondary-form" hidden>
    <div class="auth-form-icon">●</div><h3>Đặt mật khẩu mới</h3><p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
    <label>Mật khẩu mới<input id="resetPassword" type="password" minlength="6" required placeholder="Tối thiểu 6 ký tự" /></label>
    <label>Xác nhận mật khẩu<input id="resetPasswordConfirm" type="password" minlength="6" required placeholder="Nhập lại mật khẩu" /></label>
    <button class="primary-button auth-submit" type="submit">Lưu mật khẩu mới</button>
  </form>`;
$('authForm').appendChild(authExtras.firstElementChild);
$('authForm').after(authExtras);

const verifyForm = $('verifyForm'), forgotForm = $('forgotForm'), resetForm = $('resetForm'), forgotButton = $('forgotPasswordBtn');
function waitForClient() { return new Promise((resolve) => { const started = Date.now(); const check = () => { if (client) return resolve(client); if (Date.now() - started > 8000) return resolve(null); setTimeout(check, 100); }; check(); }); }
function onlyAuthForm(form) { $('authForm').hidden = form !== $('authForm'); verifyForm.hidden = form !== verifyForm; forgotForm.hidden = form !== forgotForm; resetForm.hidden = form !== resetForm; document.querySelector('.auth-tabs').hidden = form !== $('authForm'); forgotButton.hidden = form !== $('authForm') || authMode !== 'login'; }
function showVerify(email) { pendingSignupEmail = email; $('verifyEmail').textContent = email; onlyAuthForm(verifyForm); $('authTitle').textContent = 'Xác minh email'; $('authSubtitle').textContent = 'Nhập mã trong email để hoàn tất đăng ký.'; $('verifyCode').focus(); }
function showForgot() { onlyAuthForm(forgotForm); $('authTitle').textContent = 'Quên mật khẩu'; $('authSubtitle').textContent = 'Chúng tôi sẽ gửi link khôi phục về Gmail của bạn.'; $('forgotEmail').focus(); }
function showReset() { $('authScreen').hidden = false; $('appShell').hidden = true; onlyAuthForm(resetForm); $('authTitle').textContent = 'Đặt mật khẩu mới'; $('authSubtitle').textContent = 'Tạo mật khẩu mới cho tài khoản của bạn.'; $('resetPassword').focus(); }
function backToLogin() { onlyAuthForm($('authForm')); setAuthMode('login'); }

forgotButton.onclick = showForgot;
$('backToAuth').onclick = backToLogin; $('backFromForgot').onclick = backToLogin;
$('resendCode').onclick = async () => { const supabaseClient = await waitForClient(); if (!supabaseClient) return showAuthError('Website chưa kết nối được Supabase.'); const { error } = await supabaseClient.auth.resend({ type: 'signup', email: pendingSignupEmail }); if (error) return showAuthError(error.message); showAuthError('Đã gửi lại mã xác minh.'); };

$('authForm').onsubmit = async (event) => {
  event.preventDefault(); showAuthError(''); const supabaseClient = await waitForClient();
  if (!supabaseClient) return showAuthError('Website chưa được cấu hình Supabase.');
  const email = $('authEmail').value.trim().toLowerCase(), password = $('authPassword').value;
  if (authMode === 'register') {
    if (password !== $('authConfirm').value) return showAuthError('Mật khẩu xác nhận không khớp.');
    const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { name: $('authName').value.trim() } } });
    if (error) return showAuthError(error.message);
    if (data.session) return showApp(data.session.user);
    showVerify(email);
  } else {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return showAuthError('Email hoặc mật khẩu không đúng.');
    showApp(data.user); showToast('Đăng nhập thành công');
  }
};

verifyForm.onsubmit = async (event) => { event.preventDefault(); const supabaseClient = await waitForClient(); const { data, error } = await supabaseClient.auth.verifyOtp({ email: pendingSignupEmail, token: $('verifyCode').value.trim(), type: 'signup' }); if (error) return showAuthError('Mã xác minh không đúng hoặc đã hết hạn.'); showApp(data.user); showToast('Đăng ký thành công'); };
forgotForm.onsubmit = async (event) => { event.preventDefault(); const supabaseClient = await waitForClient(); const { error } = await supabaseClient.auth.resetPasswordForEmail($('forgotEmail').value.trim().toLowerCase(), { redirectTo: window.location.origin }); if (error) return showAuthError(error.message); showAuthError('Đã gửi link khôi phục. Hãy kiểm tra Gmail của bạn.'); };
resetForm.onsubmit = async (event) => { event.preventDefault(); if ($('resetPassword').value !== $('resetPasswordConfirm').value) return showAuthError('Mật khẩu xác nhận không khớp.'); const supabaseClient = await waitForClient(); const { error } = await supabaseClient.auth.updateUser({ password: $('resetPassword').value }); if (error) return showAuthError(error.message); await supabaseClient.auth.signOut({ scope: 'global' }); backToLogin(); showAuthError('Đã đổi mật khẩu. Hãy đăng nhập lại.'); };

if (client) client.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') showReset(); });
