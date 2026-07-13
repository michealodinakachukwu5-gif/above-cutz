// ABOVE CUTZ — admin login logic

// redirect straight to dashboard if already logged in
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) window.location.href = "dashboard.html";
})();

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("login-status");
  const submitBtn = document.getElementById("login-submit");

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: document.getElementById("login-email").value.trim(),
    password: document.getElementById("login-password").value,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Log In";

  if (error) {
    statusEl.textContent = "Incorrect email or password.";
    statusEl.className = "login-status error";
    return;
  }

  window.location.href = "dashboard.html";
});
