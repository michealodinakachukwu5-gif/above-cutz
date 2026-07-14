// ABOVE CUTZ — public site logic

document.getElementById("year").textContent = new Date().getFullYear();

const state = {
  services: [],
  selectedServiceId: null,
  selectedDate: null,
  selectedTime: null,
};

// ---------- helpers ----------
function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function formatTime12(t) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}
function money(n) {
  return `₦${Number(n).toLocaleString()}`;
}

// ---------- load services ----------
async function loadServices() {
  const listEl = document.getElementById("services-list");
  const selectEl = document.getElementById("service-select");

  const { data, error } = await supabaseClient
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<p class="menu-loading">Services coming soon — check back shortly.</p>`;
    return;
  }

  state.services = data;

  // Barber services on the menu board
  const barberServices = data.filter(s => s.service_type === 'barber' || !s.service_type);
  listEl.innerHTML = barberServices.length ? barberServices.map(s => `
    <div class="menu-row">
      <div>
        <span class="menu-name">${s.name}</span>
        ${s.description ? `<span class="menu-desc">${s.description}</span>` : ""}
      </div>
      <span class="menu-leader"></span>
      <span class="menu-price">${money(s.price)}</span>
    </div>
  `).join("") : `<p class="menu-loading">Services coming soon.</p>`;

  // All services in the booking dropdown with category labels
  const barber = data.filter(s => s.service_type === 'barber' || !s.service_type);
  const dental = data.filter(s => s.service_type === 'dental');

  let options = `<option value="">Choose a service…</option>`;
  if (barber.length) {
    options += `<optgroup label="✂ Barbering">` + barber.map(s => `<option value="${s.id}">${s.name} — ${money(s.price)}</option>`).join("") + `</optgroup>`;
  }
  if (dental.length) {
    options += `<optgroup label="🦷 Dental Care">` + dental.map(s => `<option value="${s.id}">${s.name} — ${money(s.price)}</option>`).join("") + `</optgroup>`;
  }
  selectEl.innerHTML = options;
}

async function loadDentalServices() {
  const listEl = document.getElementById("dental-list");
  if (!listEl) return;

  const { data, error } = await supabaseClient
    .from("services")
    .select("*")
    .eq("is_active", true)
    .eq("service_type", "dental")
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<p class="menu-loading">Dental services coming soon.</p>`;
    return;
  }

  listEl.innerHTML = data.map(s => `
    <div class="menu-row">
      <div>
        <span class="menu-name">${s.name}</span>
        ${s.description ? `<span class="menu-desc">${s.description}</span>` : ""}
      </div>
      <span class="menu-leader"></span>
      <span class="menu-price">${money(s.price)}</span>
    </div>
  `).join("");
}

// ---------- load gallery ----------
async function loadGallery() {
  const gridEl = document.getElementById("gallery-grid");
  const { data, error } = await supabaseClient
    .from("media")
    .select("*")
    .eq("section", "gallery")
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    gridEl.innerHTML = `<p class="gallery-loading">Photos coming soon.</p>`;
    return;
  }

  gridEl.innerHTML = data.map(m => `
    <figure>
      ${m.file_type === "video"
        ? `<video src="${m.file_url}" muted loop playsinline onmouseover="this.play()" onmouseout="this.pause()"></video>`
        : `<img src="${m.file_url}" alt="${m.caption || 'Above Cutz'}" loading="lazy">`
      }
    </figure>
  `).join("");
}

// ---------- load shop settings ----------
async function loadSettings() {
  const { data } = await supabaseClient.from("shop_settings").select("*").eq("id", 1).single();
  if (!data) return;

  if (data.address) document.getElementById("shop-address").textContent = data.address;
  if (data.phone) document.getElementById("shop-phone").textContent = `Tel: ${data.phone}`;
  if (data.logo_url) {
    document.querySelectorAll(".brand-logo").forEach(img => { img.src = data.logo_url; img.style.display = ""; });
  }
  if (data.whatsapp) {
    const link = document.getElementById("whatsapp-link");
    link.href = `https://wa.me/${data.whatsapp.replace(/\D/g, "")}`;
    link.style.display = "inline-flex";
  }
}

// ---------- slot computation ----------
async function computeSlots() {
  const slotsGrid = document.getElementById("slots-grid");
  const { selectedServiceId, selectedDate } = state;

  if (!selectedServiceId || !selectedDate) {
    slotsGrid.innerHTML = `<p class="slots-hint">Pick a service and date to see open times.</p>`;
    return;
  }

  const service = state.services.find(s => s.id === selectedServiceId);
  const duration = service ? service.duration_minutes : 30;
  const weekday = new Date(selectedDate + "T00:00:00").getDay();

  slotsGrid.innerHTML = `<p class="slots-hint">Checking availability…</p>`;

  const [{ data: hours }, { data: blocked }, { data: booked }] = await Promise.all([
    supabaseClient.from("business_hours").select("*").eq("weekday", weekday).single(),
    supabaseClient.from("blocked_slots").select("*").eq("block_date", selectedDate),
    supabaseClient.from("appointments").select("start_time,end_time").eq("appointment_date", selectedDate).neq("status", "cancelled"),
  ]);

  if (!hours || !hours.is_open) {
    slotsGrid.innerHTML = `<p class="slots-hint">Closed on this day — please pick another date.</p>`;
    return;
  }

  const openMin = timeToMinutes(hours.open_time);
  const closeMin = timeToMinutes(hours.close_time);
  const busyRanges = [
    ...(blocked || []).map(b => [timeToMinutes(b.start_time), timeToMinutes(b.end_time)]),
    ...(booked || []).map(b => [timeToMinutes(b.start_time), timeToMinutes(b.end_time)]),
  ];

  const step = 30; // slot granularity in minutes
  const slots = [];
  const now = new Date();
  const isToday = selectedDate === now.toISOString().slice(0, 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (let start = openMin; start + duration <= closeMin; start += step) {
    const end = start + duration;
    if (isToday && start <= nowMin) continue;
    const overlaps = busyRanges.some(([bStart, bEnd]) => start < bEnd && end > bStart);
    slots.push({ start, end, available: !overlaps });
  }

  if (slots.length === 0) {
    slotsGrid.innerHTML = `<p class="slots-hint">No slots left today — please pick another date.</p>`;
    return;
  }

  slotsGrid.innerHTML = slots.map(s => `
    <button type="button" class="slot-btn" data-start="${minutesToTime(s.start)}" data-end="${minutesToTime(s.end)}" ${s.available ? "" : "disabled"}>
      ${formatTime12(minutesToTime(s.start))}
    </button>
  `).join("");

  slotsGrid.querySelectorAll(".slot-btn:not(:disabled)").forEach(btn => {
    btn.addEventListener("click", () => {
      slotsGrid.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.selectedTime = { start: btn.dataset.start, end: btn.dataset.end };
    });
  });
}

document.getElementById("service-select").addEventListener("change", e => {
  state.selectedServiceId = e.target.value || null;
  state.selectedTime = null;
  computeSlots();
});
document.getElementById("date-input").addEventListener("change", e => {
  state.selectedDate = e.target.value || null;
  state.selectedTime = null;
  computeSlots();
});

// set min date to today
document.getElementById("date-input").min = new Date().toISOString().slice(0, 10);

// ---------- booking submit ----------
document.getElementById("booking-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("booking-status");
  const submitBtn = document.getElementById("booking-submit");

  if (!state.selectedServiceId || !state.selectedDate || !state.selectedTime) {
    statusEl.textContent = "Please choose a service, date, and time slot.";
    statusEl.className = "booking-status error";
    return;
  }
  if (!document.getElementById("address-input").value.trim()) {
    statusEl.textContent = "Please enter the address for the home visit.";
    statusEl.className = "booking-status error";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Booking…";

  const { error } = await supabaseClient.from("appointments").insert({
    service_id: state.selectedServiceId,
    customer_name: document.getElementById("name-input").value.trim(),
    customer_phone: document.getElementById("phone-input").value.trim(),
    customer_address: document.getElementById("address-input").value.trim(),
    appointment_date: state.selectedDate,
    start_time: state.selectedTime.start,
    end_time: state.selectedTime.end,
    notes: document.getElementById("notes-input").value.trim() || null,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Confirm Booking";

  if (error) {
    statusEl.textContent = "Something went wrong — please try again or WhatsApp us directly.";
    statusEl.className = "booking-status error";
    return;
  }

  statusEl.textContent = "Booked! We'll see you then. A confirmation will reach you shortly.";
  statusEl.className = "booking-status success";
  document.getElementById("booking-form").reset();
  state.selectedServiceId = null;
  state.selectedDate = null;
  state.selectedTime = null;
  computeSlots();
});

// ---------- init ----------
loadServices();
loadDentalServices();
loadGallery();
loadSettings();
