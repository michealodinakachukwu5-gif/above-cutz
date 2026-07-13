// ABOVE CUTZ — admin dashboard logic

// ---------- auth guard ----------
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) window.location.href = "login.html";
})();

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});

// ---------- sidebar nav ----------
document.querySelectorAll(".admin-nav-item[data-panel]").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav-item[data-panel]").forEach(i => i.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
    item.classList.add("active");
    document.getElementById(`panel-${item.dataset.panel}`).classList.add("active");
  });
});

function money(n) { return `₦${Number(n).toLocaleString()}`; }
function showToast(el, msg, ok) {
  el.textContent = msg;
  el.className = `toast ${ok ? "success" : "error"}`;
  setTimeout(() => { el.textContent = ""; }, 4000);
}

// ============================================================
// BOOKINGS
// ============================================================
async function loadBookings() {
  const tbody = document.getElementById("bookings-tbody");
  const dateFilter = document.getElementById("bookings-date-filter").value;

  let query = supabaseClient
    .from("appointments")
    .select("*, services(name)")
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (dateFilter) {
    query = query.eq("appointment_date", dateFilter);
  } else {
    query = query.gte("appointment_date", new Date().toISOString().slice(0, 10));
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">No bookings found.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(b => `
    <tr>
      <td>${b.appointment_date}<br><span style="color:var(--ivory-dim)">${b.start_time.slice(0,5)}</span></td>
      <td>${b.customer_name}</td>
      <td>${b.customer_phone}</td>
      <td>${b.services ? b.services.name : "—"}</td>
      <td><span class="status-pill ${b.status}">${b.status.replace("_"," ")}</span></td>
      <td>
        ${b.status === "confirmed" ? `
          <button class="icon-btn" data-action="complete" data-id="${b.id}">Complete</button>
          <button class="icon-btn" data-action="cancel" data-id="${b.id}">Cancel</button>
        ` : ""}
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const status = btn.dataset.action === "complete" ? "completed" : "cancelled";
      await supabaseClient.from("appointments").update({ status }).eq("id", btn.dataset.id);
      loadBookings();
    });
  });
}
document.getElementById("bookings-date-filter").addEventListener("change", loadBookings);

// ============================================================
// SERVICES
// ============================================================
async function loadServices() {
  const tbody = document.getElementById("services-tbody");
  const { data, error } = await supabaseClient.from("services").select("*").order("sort_order");

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No services yet — add one above.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td>${s.name}${s.description ? `<br><span style="color:var(--ivory-dim); font-size:0.82rem;">${s.description}</span>` : ""}</td>
      <td>${money(s.price)}</td>
      <td>${s.duration_minutes} min</td>
      <td>${s.is_active ? "Yes" : "No"}</td>
      <td>
        <button class="icon-btn" data-action="toggle" data-id="${s.id}" data-active="${s.is_active}">${s.is_active ? "Deactivate" : "Activate"}</button>
        <button class="icon-btn" data-action="delete" data-id="${s.id}">Delete</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-action='toggle']").forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabaseClient.from("services").update({ is_active: btn.dataset.active !== "true" }).eq("id", btn.dataset.id);
      loadServices();
    });
  });
  tbody.querySelectorAll("[data-action='delete']").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this service?")) return;
      await supabaseClient.from("services").delete().eq("id", btn.dataset.id);
      loadServices();
    });
  });
}

document.getElementById("service-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const toast = document.getElementById("service-toast");
  const { error } = await supabaseClient.from("services").insert({
    name: document.getElementById("svc-name").value.trim(),
    price: Number(document.getElementById("svc-price").value),
    duration_minutes: Number(document.getElementById("svc-duration").value),
    description: document.getElementById("svc-desc").value.trim() || null,
  });
  if (error) { showToast(toast, "Could not add service.", false); return; }
  showToast(toast, "Service added.", true);
  document.getElementById("service-form").reset();
  document.getElementById("svc-duration").value = 30;
  loadServices();
});

// ============================================================
// HOURS & BLOCKED SLOTS
// ============================================================
const WEEKDAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

async function loadHours() {
  const tbody = document.getElementById("hours-tbody");
  const { data, error } = await supabaseClient.from("business_hours").select("*").order("weekday");
  if (error || !data) { tbody.innerHTML = `<tr><td colspan="5">Could not load hours.</td></tr>`; return; }

  tbody.innerHTML = data.map(h => `
    <tr data-id="${h.id}">
      <td>${WEEKDAY_NAMES[h.weekday]}</td>
      <td><input type="checkbox" class="hr-open" ${h.is_open ? "checked" : ""}></td>
      <td><input type="time" class="hr-start" value="${h.open_time ? h.open_time.slice(0,5) : ""}"></td>
      <td><input type="time" class="hr-end" value="${h.close_time ? h.close_time.slice(0,5) : ""}"></td>
      <td><button class="icon-btn hr-save">Save</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(row => {
    row.querySelector(".hr-save").addEventListener("click", async () => {
      await supabaseClient.from("business_hours").update({
        is_open: row.querySelector(".hr-open").checked,
        open_time: row.querySelector(".hr-start").value || null,
        close_time: row.querySelector(".hr-end").value || null,
      }).eq("id", row.dataset.id);
      loadHours();
    });
  });
}

async function loadBlocked() {
  const tbody = document.getElementById("blocked-tbody");
  const { data, error } = await supabaseClient.from("blocked_slots").select("*")
    .gte("block_date", new Date().toISOString().slice(0,10)).order("block_date");
  if (error || !data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="4">No time off scheduled.</td></tr>`; return; }

  tbody.innerHTML = data.map(b => `
    <tr>
      <td>${b.block_date}</td>
      <td>${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}</td>
      <td>${b.reason || "—"}</td>
      <td><button class="icon-btn" data-id="${b.id}">Remove</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabaseClient.from("blocked_slots").delete().eq("id", btn.dataset.id);
      loadBlocked();
    });
  });
}

document.getElementById("block-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await supabaseClient.from("blocked_slots").insert({
    block_date: document.getElementById("block-date").value,
    start_time: document.getElementById("block-start").value,
    end_time: document.getElementById("block-end").value,
    reason: document.getElementById("block-reason").value.trim() || null,
  });
  document.getElementById("block-form").reset();
  loadBlocked();
});

// ============================================================
// MEDIA (photos & videos)
// ============================================================
const MAX_FILE_MB = 30;

document.getElementById("upload-drop").addEventListener("click", () => {
  document.getElementById("upload-input").click();
});

document.getElementById("upload-input").addEventListener("change", async (e) => {
  const toast = document.getElementById("media-toast");
  const files = Array.from(e.target.files);

  for (const file of files) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      showToast(toast, `${file.name} is over ${MAX_FILE_MB}MB — please compress it first.`, false);
      continue;
    }
    const fileType = file.type.startsWith("video") ? "video" : "image";
    const path = `gallery/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

    const { error: uploadError } = await supabaseClient.storage.from("media").upload(path, file);
    if (uploadError) { showToast(toast, `Upload failed: ${uploadError.message}`, false); continue; }

    const { data: urlData } = supabaseClient.storage.from("media").getPublicUrl(path);
    await supabaseClient.from("media").insert({
      file_url: urlData.publicUrl,
      file_type: fileType,
      section: "gallery",
    });
  }
  showToast(toast, "Upload complete.", true);
  e.target.value = "";
  loadMedia();
});

async function loadMedia() {
  const grid = document.getElementById("media-grid");
  const { data, error } = await supabaseClient.from("media").select("*").order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p>No photos or videos uploaded yet.</p>`;
    return;
  }

  grid.innerHTML = data.map(m => `
    <div class="media-item" data-id="${m.id}">
      ${m.file_type === "video" ? `<video src="${m.file_url}" muted></video>` : `<img src="${m.file_url}">`}
      <button class="media-delete" data-id="${m.id}">&times;</button>
    </div>
  `).join("");

  grid.querySelectorAll(".media-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this item?")) return;
      await supabaseClient.from("media").delete().eq("id", btn.dataset.id);
      loadMedia();
    });
  });
}

// ============================================================
// SETTINGS
// ============================================================
async function loadSettings() {
  const { data } = await supabaseClient.from("shop_settings").select("*").eq("id", 1).single();
  if (!data) return;
  document.getElementById("set-name").value = data.shop_name || "";
  document.getElementById("set-phone").value = data.phone || "";
  document.getElementById("set-whatsapp").value = data.whatsapp || "";
  document.getElementById("set-address").value = data.address || "";
}

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const toast = document.getElementById("settings-toast");
  const { error } = await supabaseClient.from("shop_settings").update({
    shop_name: document.getElementById("set-name").value.trim(),
    phone: document.getElementById("set-phone").value.trim(),
    whatsapp: document.getElementById("set-whatsapp").value.trim(),
    address: document.getElementById("set-address").value.trim(),
  }).eq("id", 1);
  showToast(toast, error ? "Could not save settings." : "Settings saved.", !error);
});

// ---------- init ----------
loadBookings();
loadServices();
loadHours();
loadBlocked();
loadMedia();
loadSettings();
