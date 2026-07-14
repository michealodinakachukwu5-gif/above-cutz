// ABOVE CUTZ — Dental page logic

document.getElementById("year").textContent = new Date().getFullYear();

const state = {
  services: [],
  selectedServiceId: null,
  selectedDate: null,
  selectedTime: null,
};

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
  return `$${Number(n).toLocaleString()}`;
}

// ---------- Load dental services into price board and booking dropdown ----------
async function loadDentalServices() {
  const priceList = document.getElementById("dental-price-list");
  const selectEl = document.getElementById("dental-service-select");

  const { data, error } = await supabaseClient
    .from("services")
    .select("*")
    .eq("is_active", true)
    .eq("service_type", "dental")
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    priceList.innerHTML = `<p class="menu-loading">Pricing available upon consultation — contact us for details.</p>`;
    selectEl.innerHTML = `<option value="">No dental services listed yet.</option>`;
    return;
  }

  state.services = data;

  priceList.innerHTML = data.map(s => `
    <div class="menu-row">
      <div>
        <span class="menu-name">${s.name}</span>
        ${s.description ? `<span class="menu-desc">${s.description}</span>` : ""}
      </div>
      <span class="menu-leader"></span>
      <span class="menu-price">${money(s.price)}</span>
    </div>
  `).join("");

  selectEl.innerHTML = `<option value="">Choose a treatment…</option>` +
    data.map(s => `<option value="${s.id}">${s.name} — ${money(s.price)}</option>`).join("");
}

// ---------- Load WhatsApp link ----------
async function loadSettings() {
  const { data } = await supabaseClient.from("shop_settings").select("*").eq("id", 1).single();
  if (!data) return;
  if (data.whatsapp) {
    const link = document.getElementById("dental-whatsapp");
    link.href = `https://wa.me/${data.whatsapp.replace(/\D/g, "")}`;
    link.style.display = "inline-flex";
  }
}

// ---------- Slot computation ----------
async function computeSlots() {
  const slotsGrid = document.getElementById("dental-slots-grid");
  const { selectedServiceId, selectedDate } = state;

  if (!selectedServiceId || !selectedDate) {
    slotsGrid.innerHTML = `<p class="slots-hint">Pick a treatment and date to see open times.</p>`;
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
    slotsGrid.innerHTML = `<p class="slots-hint">Not available on this day — please pick another date.</p>`;
    return;
  }

  const openMin = timeToMinutes(hours.open_time);
  const closeMin = timeToMinutes(hours.close_time);
  const busyRanges = [
    ...(blocked || []).map(b => [timeToMinutes(b.start_time), timeToMinutes(b.end_time)]),
    ...(booked || []).map(b => [timeToMinutes(b.start_time), timeToMinutes(b.end_time)]),
  ];

  const step = 30;
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
    slotsGrid.innerHTML = `<p class="slots-hint">No slots available — please pick another date.</p>`;
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

document.getElementById("dental-service-select").addEventListener("change", e => {
  state.selectedServiceId = e.target.value || null;
  state.selectedTime = null;
  computeSlots();
});
document.getElementById("dental-date-input").addEventListener("change", e => {
  state.selectedDate = e.target.value || null;
  state.selectedTime = null;
  computeSlots();
});

document.getElementById("dental-date-input").min = new Date().toISOString().slice(0, 10);

// ---------- Booking submit ----------
document.getElementById("dental-booking-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("dental-booking-status");
  const submitBtn = document.getElementById("dental-booking-submit");

  if (!state.selectedServiceId || !state.selectedDate || !state.selectedTime) {
    statusEl.textContent = "Please choose a treatment, date, and time slot.";
    statusEl.className = "booking-status error";
    return;
  }
  if (!document.getElementById("dental-address-input").value.trim()) {
    statusEl.textContent = "Please enter your address for the home visit.";
    statusEl.className = "booking-status error";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Booking…";

  const { error } = await supabaseClient.from("appointments").insert({
    service_id: state.selectedServiceId,
    customer_name: document.getElementById("dental-name-input").value.trim(),
    customer_phone: document.getElementById("dental-phone-input").value.trim(),
    customer_address: document.getElementById("dental-address-input").value.trim(),
    appointment_date: state.selectedDate,
    start_time: state.selectedTime.start,
    end_time: state.selectedTime.end,
    notes: document.getElementById("dental-notes-input").value.trim() || null,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Confirm Dental Appointment";

  if (error) {
    statusEl.textContent = "Something went wrong — please try again or message us on WhatsApp.";
    statusEl.className = "booking-status error";
    return;
  }

  statusEl.textContent = "Appointment booked! We'll confirm your visit shortly.";
  statusEl.className = "booking-status success";
  document.getElementById("dental-booking-form").reset();
  state.selectedServiceId = null;
  state.selectedDate = null;
  state.selectedTime = null;
  computeSlots();
});

// ---------- Init ----------
loadDentalServices();
loadSettings();
