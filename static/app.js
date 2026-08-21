async function parseResponseError(response, defaultMsg = "Errore durante la richiesta") {
    try {
        const err = await response.json();
        return err.detail || defaultMsg;
    } catch (e) {
        const txt = await response.text().catch(() => "");
        return txt || defaultMsg;
    }
}

async function populateSubscriptionCheckboxes(containerId, checkboxClass, selectedIds = null, filterType = "all") {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    try {
        const resp = await fetch("/api/subscriptions/types");
        if (!resp.ok) return;
        const subTypes = await resp.json();

        subTypes.forEach(st => {
            let isChecked = false;
            if (Array.isArray(selectedIds)) {
                isChecked = selectedIds.includes(st.id);
            } else if (filterType === "course") {
                const svcs = st.services || [];
                isChecked = svcs.includes("corsi") || st.id.includes("vip");
            } else if (filterType === "wellness") {
                const svcs = st.services || [];
                isChecked = svcs.includes("servizi") || st.id.includes("vip");
            }

            const label = document.createElement("label");
            label.className = "checkbox-label";
            label.style.cssText = "display: flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: normal; cursor: pointer; color: #e2e8f0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 5px 8px; border-radius: 6px;";
            label.innerHTML = `
                <input type="checkbox" class="${checkboxClass}" value="${st.id}" ${isChecked ? 'checked' : ''}> ${st.name}
            `;
            container.appendChild(label);
        });
    } catch (e) {
        console.error("Errore caricamento tipi abbonamento per checkbox", e);
    }
}


function renderAdminScheduleCell(weeklyScheduleObj) {
    if (!weeklyScheduleObj || Object.keys(weeklyScheduleObj).length === 0) {
        return `<span class="badge badge-secondary" style="font-size: 0.75rem;">Nessun orario</span>`;
    }
    
    const dayEntries = Object.entries(weeklyScheduleObj);
    const dayCount = dayEntries.length;
    
    let optionsHtml = dayEntries.map(([dCode, slots]) => {
        const dName = DAY_NAMES_IT_MAP[dCode] || dCode;
        const slotsStr = slots.join(", ");
        return `<option value="" disabled>📅 ${dName}: ${slotsStr}</option>`;
    }).join("");

    return `
        <select onclick="event.stopPropagation();" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); color: var(--info-color); border-radius: 8px; padding: 6px 12px; font-size: 0.82rem; font-weight: 600; cursor: pointer; max-width: 220px; outline: none;">
            <option value="" disabled selected>🕒 Orari (${dayCount} giorn${dayCount === 1 ? 'o' : 'i'}) ▾</option>
            ${optionsHtml}
        </select>
    `;
}

// --- STATO DELL'APPLICAZIONE ---
let currentMember = null;
let isAdminLoggedIn = false; // Stato sessione amministratore
let affluenceChartInstance = null;
let popularityChartInstance = null;

// --- ELEMENTI DOM DI USO COMUNE ---
const toast = document.getElementById("toast");
const userWidget = document.getElementById("userWidget");
const userWidgetName = document.getElementById("userWidgetName");
const userWidgetRole = document.getElementById("userWidgetRole");
const logoutBtn = document.getElementById("logoutBtn");
const authSection = document.getElementById("authSection");
const tabClient = document.getElementById("tab-client");
const tabAdmin = document.getElementById("tab-admin");
const tabTornello = document.getElementById("tab-tornello");

// ==========================================
// TOAST NOTIFICATIONS HELPER
// ==========================================
function showToast(message, type = "info") {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = "toast";
    }, 3000);
}

// CUSTOM CONFIRM MODAL HELPER
let currentConfirmAction = null;

function customConfirm(message, actionCallback) {
    document.getElementById("confirmModalMessage").textContent = message;
    currentConfirmAction = actionCallback;
    document.getElementById("confirmModal").classList.add("open");
}

function closeConfirmModal() {
    document.getElementById("confirmModal").classList.remove("open");
    currentConfirmAction = null;
}

document.getElementById("confirmModalActionBtn").addEventListener("click", () => {
    if (currentConfirmAction) {
        currentConfirmAction();
    }
    closeConfirmModal();
});

// ==========================================
// AUTH FLOW & LOGIN/REGISTER FORM HANDLERS
// ==========================================
document.getElementById("tabLoginBtn").addEventListener("click", () => {
    document.getElementById("tabLoginBtn").classList.add("active");
    document.getElementById("tabRegisterBtn").classList.remove("active");
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("registerForm").classList.add("hidden");
});

document.getElementById("tabRegisterBtn").addEventListener("click", () => {
    document.getElementById("tabRegisterBtn").classList.add("active");
    document.getElementById("tabLoginBtn").classList.remove("active");
    document.getElementById("registerForm").classList.remove("hidden");
    document.getElementById("loginForm").classList.add("hidden");
});

// Login Submit (Membro)
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Errore di autenticazione");
        }

        const data = await response.json();
        setCurrentUser(data);
        showToast(`Benvenuto, ${data.first_name}!`, "success");
    } catch (err) {
        showToast(err.message, "error");
    }
});

// Register Submit
document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const first_name = document.getElementById("regFirstName").value;
    const last_name = document.getElementById("regLastName").value;
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;
    const phone = document.getElementById("regPhone").value;
    const fiscal_code = document.getElementById("regFiscalCode").value;

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_name, last_name, email, password, phone, fiscal_code })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Errore durante la registrazione");
        }

        const data = await response.json();
        setCurrentUser(data);
        showToast("Registrazione completata con successo!", "success");
    } catch (err) {
        showToast(err.message, "error");
    }
});

// Imposta utente corrente
function setCurrentUser(member) {
    currentMember = member;
    localStorage.setItem("gym_member", JSON.stringify(member));

    // Aggiorna Sidebar Widget
    userWidgetName.textContent = `${member.first_name} ${member.last_name}`;
    userWidgetRole.textContent = "Membro Palestra";
    logoutBtn.style.display = "flex";

    // Mostra/Nascondi sezioni
    authSection.classList.add("hidden");
    tabClient.style.display = "block";
    tabAdmin.style.display = "none";
    tabTornello.style.display = "none";

    // Setta nav attiva
    setActiveNav("navClient");

    // Carica dati del profilo
    loadClientDashboard();
}

// Disconnetti utente (Membro)
logoutBtn.addEventListener("click", () => {
    currentMember = null;
    localStorage.removeItem("gym_member");
    
    userWidgetName.textContent = "Nessun utente";
    userWidgetRole.textContent = "Visitatore";
    logoutBtn.style.display = "none";

    authSection.classList.remove("hidden");
    tabClient.style.display = "none";
    tabAdmin.style.display = "none";
    tabTornello.style.display = "none";
    
    showToast("Disconnessione membro effettuata", "info");
});

// Admin Login Form Submit
document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value.trim();

    try {
        const response = await fetch("/api/auth/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Errore di accesso");
        }

        isAdminLoggedIn = true;
        localStorage.setItem("gym_admin", "true");
        
        document.getElementById("adminAuthContainer").classList.add("hidden");
        document.getElementById("adminDashboardContainer").classList.remove("hidden");
        
        showToast("Accesso Amministratore confermato!", "success");
        loadAdminDashboard();
    } catch (err) {
        showToast(err.message, "error");
    }
});

// Admin Logout
document.getElementById("adminLogoutBtn").addEventListener("click", () => {
    isAdminLoggedIn = false;
    localStorage.removeItem("gym_admin");
    
    document.getElementById("adminAuthContainer").classList.remove("hidden");
    document.getElementById("adminDashboardContainer").classList.add("hidden");
    
    showToast("Sessione Amministratore chiusa", "info");
});

// Carica sessione al boot
function initSession() {
    const saved = localStorage.getItem("gym_member");
    if (saved) {
        try {
            currentMember = JSON.parse(saved);
            userWidgetName.textContent = `${currentMember.first_name} ${currentMember.last_name}`;
            userWidgetRole.textContent = "Membro Palestra";
            logoutBtn.style.display = "flex";
        } catch (e) {
            localStorage.removeItem("gym_member");
        }
    }
    
    const adminSaved = localStorage.getItem("gym_admin");
    if (adminSaved === "true") {
        isAdminLoggedIn = true;
    }
}

// ==========================================
// TABS SWITCHING AND LOAD ACTIONS
// ==========================================
const navItems = document.querySelectorAll(".nav-item");
navItems.forEach(item => {
    item.addEventListener("click", (e) => {
        e.preventDefault();
        const tabId = item.getAttribute("data-tab");

        // Gestione visibilità in base alle sessioni
        if (tabId === "tab-client") {
            if (!currentMember) {
                authSection.classList.remove("hidden");
                tabClient.style.display = "none";
            } else {
                authSection.classList.add("hidden");
                tabClient.style.display = "block";
                loadClientDashboard();
            }
            tabAdmin.style.display = "none";
            tabTornello.style.display = "none";
        } 
        else if (tabId === "tab-admin") {
            authSection.classList.add("hidden");
            tabClient.style.display = "none";
            tabTornello.style.display = "none";
            tabAdmin.style.display = "block";
            
            if (isAdminLoggedIn) {
                document.getElementById("adminAuthContainer").classList.add("hidden");
                document.getElementById("adminDashboardContainer").classList.remove("hidden");
                loadAdminDashboard();
            } else {
                document.getElementById("adminAuthContainer").classList.remove("hidden");
                document.getElementById("adminDashboardContainer").classList.add("hidden");
            }
        } 
        else if (tabId === "tab-tornello") {
            authSection.classList.add("hidden");
            tabClient.style.display = "none";
            tabAdmin.style.display = "none";
            tabTornello.style.display = "block";
            loadTornelloDashboard();
        }

        // Imposta nav attiva
        navItems.forEach(nav => nav.classList.remove("active"));
        item.classList.add("active");
    });
});

function setActiveNav(id) {
    navItems.forEach(nav => {
        if (nav.id === id) nav.classList.add("active");
        else nav.classList.remove("active");
    });
}


// ==========================================
// FLOW CLIENTE (VISTA CLIENTE)
// ==========================================

async function loadClientDashboard() {
    if (!currentMember) return;
    
    // Aggiorna saldo portafoglio dell'utente dal backend per consistenza
    try {
        const response = await fetch(`/api/members/${currentMember.id}`);
        if (response.ok) {
            currentMember = await response.json();
            localStorage.setItem("gym_member", JSON.stringify(currentMember));
        }
    } catch (e) {}

    // 1. Saldo Portafoglio
    document.getElementById("clientBalance").textContent = `${currentMember.balance.toFixed(2)} €`;

    // 2. Abbonamento Attivo
    try {
        const subResponse = await fetch(`/api/members/${currentMember.id}/subscriptions`);
        const subs = await subResponse.json();
        const activeSub = subs.find(s => s.is_active);
        const subCard = document.querySelector(".subscription-status-card");
        const icon = document.getElementById("subStatusIcon");
        const nameText = document.getElementById("clientSubName");
        const dateText = document.getElementById("clientSubDates");
        const badge = document.getElementById("subStatusBadge");

        if (activeSub) {
            nameText.textContent = activeSub.subscription_type_id.toUpperCase() + " Pass";
            dateText.textContent = `Scadenza: ${activeSub.end_date}`;
            badge.innerHTML = `
                <span class="badge badge-success">Attivo</span>
                <button class="btn btn-danger btn-sm" id="cancelActiveSubBtn" style="margin-top: 8px; display: block; font-size: 0.7rem; padding: 4px 8px;">
                    <i class="fa-solid fa-ban"></i> Disdici
                </button>
            `;
            subCard.style.borderLeft = "4px solid var(--success-color)";
            icon.style.color = "var(--success-color)";
            
            // Collega l'evento di disdetta
            document.getElementById("cancelActiveSubBtn").addEventListener("click", cancelSubscription);
        } else {
            nameText.textContent = "Nessuno";
            dateText.textContent = "Sottoscrivi un abbonamento per accedere";
            badge.innerHTML = `<span class="badge badge-danger">Inattivo</span>`;
            subCard.style.borderLeft = "1px solid var(--border-color)";
            icon.style.color = "var(--text-muted)";
        }
    } catch (err) {
        console.error("Errore recupero abbonamento", err);
    }

    // 2b. Profilo Cliente (ID & Email)
    document.getElementById("profileIdDisplay").textContent = currentMember.id;
    document.getElementById("profileEmailDisplay").textContent = currentMember.email;
    
    // Copia ID negli appunti al click
    document.getElementById("profileIdDisplay").onclick = () => {
        navigator.clipboard.writeText(currentMember.id);
        showToast("ID copiato negli appunti!", "success");
    };

    // Imposta data minima di prenotazione a oggi
    const todayStr = new Date().toISOString().split("T")[0];
    const dateInput = document.getElementById("bookingDate");
    dateInput.min = todayStr;
    if (!dateInput.value) {
        dateInput.value = todayStr;
    }

    // 3. Carica Piani Abbonamento
    loadSubscriptionPlans();

    // 4. Carica Corsi Disponibili
    loadCoursesDropdown();

    // 5. Carica Prenotazioni Personali
    loadClientBookings();

    // 6. Carica Prodotti Smart Bar
    loadSmartBarProducts();
    initClientDatePicker();
    loadClientCoursesCards();
    loadClientWellnessCards();
    loadWellnessDropdown();
}

// Disdici Abbonamento Attivo
async function cancelSubscription() {
    if (!currentMember) return;
    customConfirm("Sei sicuro di voler disdire il tuo abbonamento attivo? Non potrai più effettuare il check-in finché non ne acquisterai uno nuovo.", async () => {
        try {
            const response = await fetch(`/api/members/${currentMember.id}/subscriptions/cancel`, {
                method: "POST"
            });
            if (response.ok) {
                showToast("Abbonamento disdetto con successo!", "success");
                loadClientDashboard();
            } else {
                const err = await response.json();
                showToast(err.detail || "Errore durante la disdetta.", "error");
            }
        } catch (e) {
            showToast("Errore di connessione al server.", "error");
        }
    });
}

// Carica listino abbonamenti
async function loadSubscriptionPlans() {
    try {
        const response = await fetch("/api/subscriptions/types");
        const plans = await response.json();
        const grid = document.getElementById("subscriptionPlansGrid");
        grid.innerHTML = "";

        plans.forEach(plan => {
            const isVip = plan.id === "vip";
            const servicesMap = {
                "sala_pesi": "Sala Pesi Completa",
                "corsi": "Tutti i Corsi Inclusi",
                "sauna": "Sauna & Idromassaggio Gratis",
                "massage_chair": "Poltrona Massaggiante Inclusa"
            };

            const servicesHtml = plan.services.map(s => `<li><i class="fa-solid fa-circle-check"></i> ${servicesMap[s] || s}</li>`).join("");

            const card = document.createElement("div");
            card.className = `glass-card plan-card ${isVip ? 'popular' : ''}`;
            card.innerHTML = `
                <h3>${plan.name}</h3>
                <div class="plan-price">
                    <span class="price">${plan.price.toFixed(2)} €</span>
                    <span class="period">/ ${plan.duration_days} gg</span>
                </div>
                <ul class="plan-features">
                    ${servicesHtml}
                </ul>
                <button class="btn ${isVip ? 'btn-primary' : 'btn-secondary'} btn-full" onclick="purchaseSubscription('${plan.id}')">
                    Sottoscrivi Piano
                </button>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Errore piani abbonamento", err);
    }
}

// Acquista Abbonamento
async function purchaseSubscription(planId) {
    if (!currentMember) return;
    const today = new Date().toISOString().split("T")[0];

    try {
        const response = await fetch(`/api/members/${currentMember.id}/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                member_id: currentMember.id,
                subscription_type_id: planId,
                start_date: today
            })
        });

        if (!response.ok) {
            const detail = await parseResponseError(response, "Errore acquisto abbonamento");
            throw new Error(detail);
        }

        showToast("Abbonamento acquistato con successo!", "success");
        loadClientDashboard();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// Carica corsi nella tendina prenotazione
async function loadCoursesDropdown() {
    try {
        const response = await fetch("/api/courses");
        const courses = await response.json();
        const optgroup = document.getElementById("bookingCoursesOptGroup");
        optgroup.innerHTML = "";

        courses.forEach(c => {
            const opt = document.createElement("option");
            opt.value = `course:${c.id}`;
            opt.textContent = `${c.name} (${c.schedule})`;
            optgroup.appendChild(opt);
        });
    } catch (e) {}
}

// Invia prenotazione corso/servizio
document.getElementById("submitBookingBtn").addEventListener("click", async () => {
    const service_type = document.getElementById("bookingService").value;
    const booking_date = document.getElementById("bookingDate").value;
    const time_slot = document.getElementById("bookingTimeSlot").value;

    if (!service_type || !booking_date || !time_slot) {
        showToast("Compila tutti i campi di prenotazione", "error");
        return;
    }

    try {
        const response = await fetch("/api/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                member_id: currentMember.id,
                service_type,
                booking_date,
                time_slot
            })
        });

        if (!response.ok) {
            const detail = await parseResponseError(response, "Errore di prenotazione");
            throw new Error(detail);
        }

        showToast("Prenotazione salvata con successo!", "success");
        loadClientDashboard();
    } catch (err) {
        showToast(err.message, "error");
    }
});

// Carica prenotazioni personali del cliente
async function loadClientBookings() {
    if (!currentMember) return;
    try {
        const response = await fetch(`/api/members/${currentMember.id}/bookings`);
        const bookings = await response.json();
        const tbody = document.getElementById("clientBookingsTable");
        tbody.innerHTML = "";

        if (bookings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Nessuna prenotazione attiva.</td></tr>`;
            return;
        }

        // Carichiamo corsi e servizi benessere per risolverne i nomi leggibili
        const [coursesResp, wellnessResp] = await Promise.all([
            fetch("/api/courses").catch(() => null),
            fetch("/api/wellness-services").catch(() => null)
        ]);
        const courses = coursesResp && coursesResp.ok ? await coursesResp.json() : [];
        const wellnessServices = wellnessResp && wellnessResp.ok ? await wellnessResp.json() : [];

        bookings.forEach(b => {
            let serviceName = b.service_type;

            if (b.service_type.startsWith("course:")) {
                const cId = b.service_type.split(":")[1];
                const c = courses.find(item => item.id === cId);
                serviceName = c ? c.name : "Corso Gruppo";
            } else if (b.service_type.startsWith("wellness:")) {
                const wId = b.service_type.split(":")[1];
                const w = wellnessServices.find(item => item.id === wId);
                if (w) {
                    serviceName = w.name;
                } else if (wId === "sauna") {
                    serviceName = "Sauna Relax & Idromassaggio";
                } else if (wId === "massage_chair") {
                    serviceName = "Poltrona Massaggiante Shiatsu";
                } else {
                    serviceName = wId.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                }
            } else {
                const w = wellnessServices.find(item => item.id === b.service_type);
                if (w) {
                    serviceName = w.name;
                } else if (b.service_type === "sauna") {
                    serviceName = "Sauna Relax & Idromassaggio";
                } else if (b.service_type === "massage_chair") {
                    serviceName = "Poltrona Massaggiante Shiatsu";
                } else {
                    serviceName = b.service_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                }
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${serviceName}</strong></td>
                <td>${b.booking_date}</td>
                <td>${b.time_slot}</td>
                <td>${b.cost > 0 ? b.cost.toFixed(2) + ' €' : 'Incluso'}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="cancelBooking('${b.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {}
}

async function cancelBooking(bookingId) {
    customConfirm("Sei sicuro di voler cancellare questa prenotazione? Eventuali rimborsi saranno accreditati sul portafoglio.", async () => {
        try {
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: "DELETE"
            });
            if (response.ok) {
                showToast("Prenotazione rimossa con successo", "success");
                loadClientDashboard();
            } else {
                showToast("Errore durante la rimozione", "error");
            }
        } catch (e) {}
    });
}

// Carica prodotti smart bar
async function loadSmartBarProducts() {
    try {
        const response = await fetch("/api/products");
        const products = await response.json();
        const grid = document.getElementById("productsGrid");
        grid.innerHTML = "";

        const iconsMap = {
            "p1": "fa-bottle-water",
            "p2": "fa-bolt-lightning",
            "p3": "fa-cookie-bite",
            "p4": "fa-glass-water"
        };

        products.forEach(p => {
            const card = document.createElement("div");
            card.className = "glass-card product-card";
            card.innerHTML = `
                <div class="product-image-container">
                    <i class="fa-solid ${iconsMap[p.id] || 'fa-store'}"></i>
                </div>
                <div class="product-info">
                    <h3>${p.name}</h3>
                </div>
                <div class="product-meta">
                    <span class="product-price">${p.price.toFixed(2)} €</span>
                    <span class="product-stock">Disp: ${p.stock}</span>
                </div>
                <button class="btn btn-primary btn-sm margin-top-10" onclick="buyProduct('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-cart-shopping"></i> Acquista
                </button>
            `;
            grid.appendChild(card);
        });
    } catch (e) {}
}

async function buyProduct(productId) {
    if (!currentMember) return;
    try {
        const response = await fetch("/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                member_id: currentMember.id,
                product_id: productId
            })
        });

        if (!response.ok) {
            const detail = await parseResponseError(response, "Errore di acquisto");
            throw new Error(detail);
        }

        showToast("Prodotto acquistato! Credito scalato.", "success");
        loadClientDashboard();
    } catch (err) {
        showToast(err.message, "error");
    }
}


// ==========================================
// MODALE RICARICA PORTAFOGLIO
// ==========================================
const rechargeModal = document.getElementById("rechargeModal");
document.getElementById("openRechargeModalBtn").addEventListener("click", () => rechargeModal.classList.add("open"));
document.getElementById("closeRechargeModalBtn").addEventListener("click", () => rechargeModal.classList.remove("open"));
document.getElementById("cancelRechargeBtn").addEventListener("click", () => rechargeModal.classList.remove("open"));

// Shortcut Buttons
document.querySelectorAll(".shortcut-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.getElementById("rechargeAmountInput").value = btn.getAttribute("data-value");
    });
});

// Conferma Ricarica
document.getElementById("confirmRechargeBtn").addEventListener("click", async () => {
    const amount = parseFloat(document.getElementById("rechargeAmountInput").value);
    if (isNaN(amount) || amount <= 0) {
        showToast("Inserisci un importo valido e maggiore di zero.", "error");
        return;
    }

    try {
        const response = await fetch(`/api/members/${currentMember.id}/recharge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount })
        });

        if (response.ok) {
            showToast(`Ricarica completata! Aggiunti ${amount.toFixed(2)} €`, "success");
            rechargeModal.classList.remove("open");
            loadClientDashboard();
        } else {
            showToast("Impossibile completare la ricarica", "error");
        }
    } catch (e) {}
});


// ==========================================
// MODALE MODIFICA PROFILO
// ==========================================
const profileModal = document.getElementById("profileModal");
const openProfileModalBtn = document.getElementById("openProfileModalBtn");
const closeProfileModalBtn = document.getElementById("closeProfileModalBtn");
const cancelProfileBtn = document.getElementById("cancelProfileBtn");
const confirmProfileBtn = document.getElementById("confirmProfileBtn");

openProfileModalBtn.addEventListener("click", () => {
    if (!currentMember) return;
    document.getElementById("editFirstName").value = currentMember.first_name || "";
    document.getElementById("editLastName").value = currentMember.last_name || "";
    document.getElementById("editPhone").value = currentMember.phone || "";
    document.getElementById("editFiscalCode").value = currentMember.fiscal_code || "";
    profileModal.classList.add("open");
});

closeProfileModalBtn.addEventListener("click", () => profileModal.classList.remove("open"));
cancelProfileBtn.addEventListener("click", () => profileModal.classList.remove("open"));

confirmProfileBtn.addEventListener("click", async () => {
    const first_name = document.getElementById("editFirstName").value.trim();
    const last_name = document.getElementById("editLastName").value.trim();
    const phone = document.getElementById("editPhone").value.trim();
    const fiscal_code = document.getElementById("editFiscalCode").value.trim();

    if (!first_name || !last_name) {
        showToast("Nome e cognome sono obbligatori.", "error");
        return;
    }

    try {
        const response = await fetch(`/api/members/${currentMember.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_name, last_name, phone, fiscal_code, email: currentMember.email })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Errore aggiornamento profilo");
        }

        const updatedMember = await response.json();
        // Aggiorna lo stato locale
        currentMember = updatedMember;
        localStorage.setItem("gym_member", JSON.stringify(currentMember));
        
        // Aggiorna il widget della sidebar
        userWidgetName.textContent = `${currentMember.first_name} ${currentMember.last_name}`;

        showToast("Profilo aggiornato con successo!", "success");
        profileModal.classList.remove("open");
        loadClientDashboard();
    } catch (err) {
        showToast(err.message, "error");
    }
});


// ==========================================
// FLOW ADMIN (VISTA ADMIN)
// ==========================================

async function loadAdminDashboard() {
    try {
        const periodFilter = document.getElementById("affluencePeriodFilter");
        const periodWeeks = periodFilter ? periodFilter.value : "1";
        
        // 1. Statistiche finanziarie e di gradimento
        const response = await fetch(`/api/admin/stats?period_weeks=${periodWeeks}`);
        const stats = await response.json();

        document.getElementById("statTotalRevenue").textContent = `${stats.financials.total.toFixed(2)} €`;
        document.getElementById("statSubRevenue").textContent = `${stats.financials.subscriptions.toFixed(2)} €`;
        document.getElementById("statBarRevenue").textContent = `${stats.financials.bar.toFixed(2)} €`;
        document.getElementById("statServicesRevenue").textContent = `${stats.financials.services.toFixed(2)} €`;

        // Inizializza o aggiorna Grafico Affluenza
        window.currentAffluenceData = stats.affluence;
        window.currentAffluenceTotals = stats.affluence_totals;
        
        function updatePeakHoursText(dayData) {
            const peakTextEl = document.getElementById("peakHoursText");
            if (!peakTextEl) return;
            if (!dayData) {
                peakTextEl.textContent = "Fasce orarie di punta: Dati insufficienti";
                return;
            }
            const sortedHours = Object.entries(dayData)
                .filter(entry => entry[1] > 0)
                .sort((a, b) => b[1] - a[1]);
            
            // Trova il valore del terzo picco (o l'ultimo disponibile se sono meno di 3)
            let peakHours = [];
            if (sortedHours.length > 0) {
                const thresholdValue = sortedHours[Math.min(2, sortedHours.length - 1)][1];
                // Includiamo tutti gli orari che hanno un valore >= alla soglia, ordinandoli cronologicamente
                peakHours = sortedHours
                    .filter(entry => entry[1] >= thresholdValue)
                    .map(entry => entry[0])
                    .sort();
            }
            
            if (peakHours.length > 0) {
                peakTextEl.textContent = `Fasce orarie di punta: ${peakHours.join(", ")}`;
            } else {
                peakTextEl.textContent = "Fasce orarie di punta: Dati insufficienti";
            }
        }
        
        const dayFilter = document.getElementById("affluenceDayFilter");
        const selectedDay = dayFilter ? dayFilter.value : "all";
        
        function updateSelectedDatesText(dayVal) {
            const selectedDatesText = document.getElementById("selectedDatesText");
            if (selectedDatesText && stats.dates_by_filter) {
                if (dayVal === "all") {
                    selectedDatesText.textContent = `Date considerate: ${stats.week_range}`;
                } else {
                    const dates = stats.dates_by_filter[dayVal];
                    selectedDatesText.textContent = `Date considerate: ${dates.join(", ")}`;
                }
            }
        }
        
        const weekRangeText = document.getElementById("weekRangeText");
        if (weekRangeText && stats.week_range) {
            weekRangeText.textContent = `Periodo di riferimento: Dal ${stats.week_range.split(' - ')[0]} al ${stats.week_range.split(' - ')[1]}`;
        }
        
        initAffluenceChart(window.currentAffluenceData[selectedDay], window.currentAffluenceTotals);
        updatePeakHoursText(window.currentAffluenceData[selectedDay]);
        updateSelectedDatesText(selectedDay);
        
        if (dayFilter && !dayFilter.dataset.listenerAttached) {
            dayFilter.dataset.listenerAttached = "true";
            dayFilter.addEventListener("change", (e) => {
                if (window.currentAffluenceData) {
                    initAffluenceChart(window.currentAffluenceData[e.target.value], window.currentAffluenceTotals);
                    updatePeakHoursText(window.currentAffluenceData[e.target.value]);
                    updateSelectedDatesText(e.target.value);
                }
            });
        }
        
        if (periodFilter && !periodFilter.dataset.listenerAttached) {
            periodFilter.dataset.listenerAttached = "true";
            periodFilter.addEventListener("change", (e) => {
                // Ricarica la dashboard per il nuovo periodo
                loadAdminDashboard();
            });
        }

        // Inizializza o aggiorna Grafico Popolarità
        initPopularityChart(stats.popularity);

        // 2. Anagrafica Utenti
        loadAdminMembersTable();

        // 3. Tipologie Abbonamento (RF6)
        loadAdminSubTypesTable();

        // 4. Storico Sottoscrizioni
        loadSubscriptionHistory();
        loadAdminCoursesTable();
        loadAdminWellnessTable();

        // 5. Catalogo Prodotti (RF18)
        loadAdminProductsTable();

        // 6. Tabella Staff (RF27)
        loadAdminStaffTable();
    } catch (e) {
        console.error("Errore caricamento statistiche admin", e);
    }
}

// Inizializza grafico affluenza
function initAffluenceChart(affluenceData, affluenceTotals) {
    const ctx = document.getElementById("affluenceChart").getContext("2d");
    const labels = Object.keys(affluenceData);
    const data = Object.values(affluenceData);

    if (affluenceChartInstance) {
        affluenceChartInstance.destroy();
    }

    affluenceChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Media Ingressi Convalidati",
                data: data,
                borderColor: "#7f5af0",
                backgroundColor: "rgba(127, 90, 240, 0.1)",
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: "#7f5af0",
                pointBorderColor: "#fff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                            }
                            if (affluenceTotals) {
                                const hourKey = context.label;
                                const total = affluenceTotals[hourKey] || 0;
                                label += ` (Totale complessivo: ${total})`;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: "#94a1b2", stepSize: 1 },
                    grid: { color: "rgba(255, 255, 255, 0.05)" }
                },
                x: {
                    ticks: { color: "#94a1b2" },
                    grid: { display: false }
                }
            }
        }
    });
}

// Inizializza grafico popolarità
function initPopularityChart(popularityData) {
    const ctx = document.getElementById("popularityChart").getContext("2d");
    
    // Combiniamo servizi e corsi popolari per renderizzarli in un unico grafico a barre
    const labels = [];
    const values = [];

    // Funzione helper per accorciare i nomi troppo lunghi
    function shortenLabel(name) {
        if (!name) return "";
        let lower = name.toLowerCase();
        if (lower.includes("sauna")) return "Sauna";
        if (lower.includes("poltrona")) return "Poltrona";
        
        let shortName = name.split(/&|-|\(/)[0].trim();
        const words = shortName.split(/\s+/);
        if (words.length > 2) {
            shortName = words.slice(0, 2).join(" ");
        }
        if (shortName.length > 16) {
            return shortName.substring(0, 14) + "...";
        }
        return shortName;
    }

    // Servizi benessere
    for (const [serviceName, count] of Object.entries(popularityData.services)) {
        labels.push(shortenLabel(serviceName));
        values.push(count);
    }

    // Corsi
    for (const [courseName, count] of Object.entries(popularityData.courses)) {
        labels.push(shortenLabel(courseName));
        values.push(count);
    }

    if (popularityChartInstance) {
        popularityChartInstance.destroy();
    }

    popularityChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    "rgba(127, 90, 240, 0.8)",
                    "rgba(61, 169, 252, 0.8)",
                    "rgba(44, 182, 125, 0.8)",
                    "rgba(255, 185, 56, 0.8)",
                    "rgba(255, 92, 92, 0.8)"
                ],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: "#94a1b2", stepSize: 1 },
                    grid: { color: "rgba(255, 255, 255, 0.05)" }
                },
                x: {
                    ticks: { color: "#94a1b2" },
                    grid: { display: false }
                }
            }
        }
    });
    
    // Popola tabella Classifica (RF26)
    renderPopularityRanking(popularityData);
}

// Renderizza la classifica (RF26)
function renderPopularityRanking(popularityData) {
    const tbody = document.getElementById("adminPopularityTable");
    if (!tbody) return;

    const items = [];
    
    // Aggiungi servizi
    for (const [serviceName, count] of Object.entries(popularityData.services)) {
        items.push({ name: serviceName, type: "Servizio Benessere", count: count });
    }
    
    // Aggiungi corsi
    for (const [courseName, count] of Object.entries(popularityData.courses)) {
        items.push({ name: courseName, type: "Corso di Gruppo", count: count });
    }

    // Ordina in modo decrescente
    items.sort((a, b) => b.count - a.count);

    tbody.innerHTML = "";
    
    let position = 1;
    items.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>#${position}</strong></td>
            <td>${item.name}</td>
            <td><span class="badge badge-secondary" style="font-size: 0.75rem;">${item.type}</span></td>
            <td><strong>${item.count}</strong></td>
        `;
        tbody.appendChild(tr);
        position++;
    });
}

// Carica anagrafica utenti per l'admin
async function loadAdminMembersTable() {
    try {
        const response = await fetch("/api/members");
        const members = await response.json();
        const tbody = document.getElementById("adminMembersTable");
        tbody.innerHTML = "";

        members.forEach(m => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${m.first_name} ${m.last_name}</strong></td>
                <td>${m.email}</td>
                <td>${m.phone || '-'}</td>
                <td>${m.balance.toFixed(2)} €</td>
                <td>
                    <span class="badge ${m.is_active ? 'badge-success' : 'badge-danger'}">
                        ${m.is_active ? 'Attivo' : 'Sospeso'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="adminRecharge('${m.id}')" title="Ricarica Manuale">
                        <i class="fa-solid fa-money-bill-wave"></i> + Ricarica
                    </button>
                    <button class="btn ${m.is_active ? 'btn-danger' : 'btn-success'} btn-sm" onclick="toggleAccountStatus('${m.id}')" title="${m.is_active ? 'Sospendi Account' : 'Attiva Account'}">
                        <i class="fa-solid ${m.is_active ? 'fa-user-slash' : 'fa-user-check'}"></i> ${m.is_active ? 'Sospendi' : 'Attiva'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {}
}

async function adminRecharge(memberId) {
    const valStr = prompt("Inserisci l'importo da accreditare sul conto dell'utente (€):");
    if (valStr === null) return;
    const amount = parseFloat(valStr);
    if (isNaN(amount) || amount <= 0) {
        alert("Importo non valido!");
        return;
    }

    try {
        const response = await fetch(`/api/members/${memberId}/recharge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount })
        });
        if (response.ok) {
            showToast("Accredito amministrativo eseguito!", "success");
            loadAdminDashboard();
        } else {
            showToast("Impossibile completare l'operazione", "error");
        }
    } catch (e) {}
}

async function toggleAccountStatus(memberId) {
    customConfirm("Sei sicuro di voler modificare lo stato di attivazione di questo account?", async () => {
        try {
            const response = await fetch(`/api/members/${memberId}/toggle-status`, { method: "POST" });
            if (response.ok) {
                showToast("Stato account aggiornato con successo!", "success");
                loadAdminDashboard();
            } else {
                showToast("Impossibile modificare lo stato dell'account", "error");
            }
        } catch (e) {}
    });
}


// --- GESTIONE ABBONAMENTI ADMIN (RF6) ---
const subTypeModal = document.getElementById("subTypeModal");
const openAddSubBtn = document.getElementById("openAddSubBtn");
const closeSubTypeModalBtn = document.getElementById("closeSubTypeModalBtn");
const cancelSubTypeBtn = document.getElementById("cancelSubTypeBtn");
const confirmSubTypeBtn = document.getElementById("confirmSubTypeBtn");

// Apri modale per nuovo abbonamento
if (openAddSubBtn) {
    openAddSubBtn.addEventListener("click", () => {
        document.getElementById("subTypeModalTitle").textContent = "Nuova Tipologia Abbonamento";
        const idInput = document.getElementById("subTypeId");
        idInput.value = "";
        idInput.disabled = false;
        document.getElementById("subTypeName").value = "";
        document.getElementById("subTypePrice").value = "";
        document.getElementById("subTypeDuration").value = "";
        
        // Resetta i 4 servizi inclusi
        document.getElementById("srvSalaPesi").checked = true;
        document.getElementById("srvCorsi").checked = false;
        document.getElementById("srvServizi").checked = false;
        document.getElementById("srvBevande").checked = false;

        subTypeModal.classList.add("open");
    });
}

// Chiudi modale
if (closeSubTypeModalBtn) closeSubTypeModalBtn.addEventListener("click", () => subTypeModal.classList.remove("open"));
if (cancelSubTypeBtn) cancelSubTypeBtn.addEventListener("click", () => subTypeModal.classList.remove("open"));

// Salva abbonamento (RF6 - Create & Update)
if (confirmSubTypeBtn) {
    confirmSubTypeBtn.addEventListener("click", async () => {
        const idInput = document.getElementById("subTypeId");
        const id = idInput.value.trim().toLowerCase();
        const name = document.getElementById("subTypeName").value.trim();
        const price = parseFloat(document.getElementById("subTypePrice").value);
        const duration_days = parseInt(document.getElementById("subTypeDuration").value);

        if (!id || !name || isNaN(price) || isNaN(duration_days)) {
            showToast("Compila tutti i campi correttamente.", "error");
            return;
        }

        // Costruisci l'elenco dei 4 servizi selezionati
        const services = [];
        if (document.getElementById("srvSalaPesi").checked) services.push("sala_pesi");
        if (document.getElementById("srvCorsi").checked) services.push("corsi");
        if (document.getElementById("srvServizi").checked) services.push("servizi");
        if (document.getElementById("srvBevande").checked) services.push("bevande");

        const payload = {
            id,
            name,
            price,
            duration_days,
            services
        };

        try {
            const response = await fetch("/api/subscriptions/types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast("Tipologia abbonamento salvata con successo!", "success");
                subTypeModal.classList.remove("open");
                loadAdminDashboard();
            } else {
                const err = await response.json();
                showToast(err.detail || "Errore durante il salvataggio", "error");
            }
        } catch (e) {
            showToast("Errore di connessione al server", "error");
        }
    });
}

window.editSubType = editSubType;
window.deleteSubType = deleteSubType;

// Carica la tabella degli abbonamenti nel pannello Admin
async function loadAdminSubTypesTable() {
    try {
        const response = await fetch("/api/subscriptions/types");
        const subTypes = await response.json();
        const tbody = document.getElementById("adminSubTypesTable");
        if (!tbody) return;
        tbody.innerHTML = "";

        subTypes.forEach(st => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><code>${st.id}</code></td>
                <td><strong>${st.name}</strong></td>
                <td>${st.price.toFixed(2)} €</td>
                <td>${st.duration_days} giorni</td>
                <td>${(st.services || []).map(s => {
                    const labelMap = {
                        "sala_pesi": "Sala Pesi",
                        "corsi": "Corsi",
                        "servizi": "Servizi",
                        "sauna": "Servizi",
                        "massage_chair": "Servizi",
                        "poltrona_massaggio": "Servizi",
                        "bevande": "Bevande Gratis"
                    };
                    return `<span class="badge badge-info" style="font-size: 0.7rem; margin-right: 3px;">${labelMap[s] || s}</span>`;
                }).join('') || 'Nessuno'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editSubType('${st.id}', '${st.name.replace(/'/g, "\\'")}', ${st.price}, ${st.duration_days}, '${st.services.join(',')}')" title="Modifica">
                        <i class="fa-solid fa-pen"></i> Modifica
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSubType('${st.id}')" title="Rimuovi">
                        <i class="fa-solid fa-trash"></i> Elimina
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Errore caricamento tipi abbonamento", e);
    }
}

// Prepara la modifica dell'abbonamento
function editSubType(id, name, price, duration, servicesStr) {
    document.getElementById("subTypeModalTitle").textContent = "Modifica Tipologia Abbonamento";
    
    const idInput = document.getElementById("subTypeId");
    idInput.value = id;
    idInput.disabled = true; // Non modifichiamo la chiave primaria
    
    document.getElementById("subTypeName").value = name;
    document.getElementById("subTypePrice").value = price;
    document.getElementById("subTypeDuration").value = duration;

    const services = servicesStr ? servicesStr.split(',') : [];
    document.getElementById("srvSalaPesi").checked = services.includes("sala_pesi");
    document.getElementById("srvCorsi").checked = services.includes("corsi");
    document.getElementById("srvServizi").checked = services.includes("servizi") || services.includes("sauna") || services.includes("massage_chair") || services.includes("poltrona_massaggio");
    document.getElementById("srvBevande").checked = services.includes("bevande");

    subTypeModal.classList.add("open");
}

// Rimuovi tipologia di abbonamento (RF6 - Delete)
async function deleteSubType(subTypeId) {
    customConfirm(`Sei sicuro di voler eliminare la tipologia di abbonamento '${subTypeId}'? Questa azione non può essere annullata.`, async () => {
        try {
            const res = await fetch(`/api/subscriptions/types/${subTypeId}`, { method: "DELETE" });
            if (res.ok) {
                showToast("Tipologia abbonamento rimossa con successo!", "success");
                loadAdminDashboard();
            } else {
                const err = await res.json();
                showToast(err.detail || "Errore durante l'eliminazione", "error");
            }
        } catch (e) {
            showToast("Errore di connessione al server", "error");
        }
    });
}

// --- STORICO SOTTOSCRIZIONI (ADMIN) ---
let subscriptionHistoryData = [];

async function loadSubscriptionHistory() {
    try {
        const response = await fetch('/api/admin/subscriptions-history');
        if (response.ok) {
            subscriptionHistoryData = await response.json();
            const select = document.getElementById('historyMemberSelect');
            if(!select) return;
            select.innerHTML = '<option value="">-- Seleziona Membro --</option>';
            subscriptionHistoryData.forEach(member => {
                const option = document.createElement('option');
                option.value = member.member_id;
                option.textContent = `${member.first_name} ${member.last_name} (${member.email})`;
                select.appendChild(option);
            });
            // Clear current table
            renderSubscriptionHistory("");
        }
    } catch (error) {
        console.error("Errore nel caricamento storico abbonamenti:", error);
    }
}

window.renderSubscriptionHistory = function(memberId) {
    const tbody = document.getElementById('subscriptionHistoryTableBody');
    if (!tbody) return;
    if (!memberId) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Seleziona un membro per visualizzare lo storico.</td></tr>';
        return;
    }
    const member = subscriptionHistoryData.find(m => m.member_id === memberId);
    if (!member || !member.subscriptions || member.subscriptions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Nessun abbonamento trovato per questo membro.</td></tr>';
        return;
    }
    
    // Fallback in case window.subscriptionTypes is not populated yet
    const subTypesMap = {};
    if (window.subscriptionTypes) {
        window.subscriptionTypes.forEach(st => {
            subTypesMap[st.id] = st.name;
        });
    }

    tbody.innerHTML = '';
    // Sort subscriptions: most recent start_date first
    const sortedSubs = [...member.subscriptions].sort((a, b) => b.start_date.localeCompare(a.start_date));
    
    sortedSubs.forEach(sub => {
        const subName = subTypesMap[sub.subscription_type_id] || sub.subscription_type_id;
        const statusBadge = sub.is_active 
            ? '<span class="badge" style="background:var(--success-color);color:#fff;padding:4px 8px;border-radius:12px;font-size:12px;">Attivo</span>' 
            : '<span class="badge" style="background:var(--text-muted);color:#fff;padding:4px 8px;border-radius:12px;font-size:12px;">Scaduto</span>';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${subName}</strong></td>
            <td>${sub.start_date}</td>
            <td>${sub.end_date}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}


// --- GESTIONE CATALOGO PRODOTTI (RF18) ---
async function loadAdminProductsTable() {
    try {
        const response = await fetch("/api/products");
        if (response.ok) {
            const products = await response.json();
            const tbody = document.getElementById("adminProductsTable");
            if (!tbody) return;
            tbody.innerHTML = "";
            
            if (products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Nessun prodotto nel catalogo.</td></tr>';
                return;
            }

            products.forEach(p => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${p.name}</strong></td>
                    <td>${p.price.toFixed(2)} €</td>
                    <td>${p.stock}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, ${p.stock})" title="Modifica">
                            <i class="fa-solid fa-pen"></i> Modifica
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')" title="Rimuovi">
                            <i class="fa-solid fa-trash"></i> Elimina
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("Errore caricamento catalogo prodotti", e);
    }
}

window.openAddProductModal = function() {
    document.getElementById("productModalTitle").textContent = "Nuovo Prodotto";
    document.getElementById("productForm").reset();
    document.getElementById("productId").value = "";
    document.getElementById("productModal").classList.add("open");
}

window.editProduct = function(id, name, price, stock) {
    document.getElementById("productModalTitle").textContent = "Modifica Prodotto";
    document.getElementById("productId").value = id;
    document.getElementById("productName").value = name;
    document.getElementById("productPrice").value = price;
    document.getElementById("productStock").value = stock;
    document.getElementById("productModal").classList.add("open");
}

if(document.getElementById("confirmProductBtn")) {
    document.getElementById("confirmProductBtn").addEventListener("click", async () => {
        const id = document.getElementById("productId").value;
        const name = document.getElementById("productName").value.trim();
        const price = parseFloat(document.getElementById("productPrice").value);
        const stock = parseInt(document.getElementById("productStock").value, 10);

        if (!name || isNaN(price) || isNaN(stock)) {
            showToast("Compila tutti i campi correttamente", "error");
            return;
        }

        const payload = { name, price, stock };
        let url = "/api/products";
        if (id) {
            url += `?product_id=${encodeURIComponent(id)}`;
        }

        try {
            const response = await fetch(url, {
                method: "POST", // L'API per la creazione/aggiornamento accetta POST
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast("Prodotto salvato con successo!", "success");
                document.getElementById("productModal").classList.remove("open");
                loadAdminProductsTable();
            } else {
                showToast("Errore nel salvataggio", "error");
            }
        } catch (e) {
            showToast("Errore di connessione", "error");
        }
    });
}

window.deleteProduct = async function(productId) {
    customConfirm("Sei sicuro di voler eliminare questo prodotto dal catalogo?", async () => {
        try {
            const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
            if (res.ok) {
                showToast("Prodotto eliminato con successo", "success");
                loadAdminProductsTable();
            } else {
                showToast("Impossibile eliminare il prodotto", "error");
            }
        } catch (e) {}
    });
}


// ==========================================
// FLOW TORNELLO (SCHERMATA SIMULATORE ACCESSI)
// ==========================================

function loadTornelloDashboard() {
    loadAccessLogsList();
}

// Invia richiesta check-in tornello
document.getElementById("checkInForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputField = document.getElementById("checkInInput");
    const term = inputField.value.trim();
    if (!term) return;

    const ring = document.getElementById("tornelloLightRing");
    const statusIcon = document.getElementById("tornelloStatusIcon");
    const statusText = document.getElementById("tornelloStatusText");
    const deviceStatus = document.getElementById("deviceStatus");

    try {
        const response = await fetch("/api/check-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ member_id_or_email: term })
        });

        if (!response.ok) {
            throw new Error("Errore comunicazione tornello.");
        }

        const data = await response.json();
        
        // Reset classi
        ring.className = "tornello-light-ring";

        if (data.is_allowed) {
            // Accesso consentito: Anima Verde
            ring.classList.add("allowed");
            statusIcon.className = "fa-solid fa-circle-check";
            statusText.innerHTML = `CONSENTITO<br><span style="font-size: 0.65rem; color:#fff">${data.member_name}</span>`;
            deviceStatus.textContent = "ACCESSO OK";
            showToast(`Accesso consentito per ${data.member_name}!`, "success");
        } else {
            // Accesso negato: Anima Rosso
            ring.classList.add("denied");
            statusIcon.className = "fa-solid fa-circle-xmark";
            statusText.innerHTML = `NEGATO<br><span style="font-size: 0.55rem; color:#fff">${data.reason}</span>`;
            deviceStatus.textContent = "ACCESSO KO";
            showToast(`Accesso negato: ${data.reason}`, "error");
        }

        // Pulisce il campo e ricarica i log
        inputField.value = "";
        loadAccessLogsList();

        // Ripristina lo stato neutro del tornello dopo 4 secondi
        setTimeout(() => {
            ring.className = "tornello-light-ring";
            statusIcon.className = "fa-solid fa-id-card-clip";
            statusText.textContent = "ACCENDA IL BADGE";
            deviceStatus.textContent = "PRONTO";
        }, 4000);

    } catch (err) {
        showToast(err.message, "error");
    }
});

// Carica lo storico degli accessi visualizzato sulla destra del tornello
async function loadAccessLogsList() {
    try {
        const response = await fetch("/api/admin/logs");
        const logs = await response.json();
        const container = document.getElementById("tornelloLogsList");
        container.innerHTML = "";

        if (logs.length === 0) {
            container.innerHTML = `<div class="text-center text-muted p-3">Nessun passaggio registrato.</div>`;
            return;
        }

        // Carichiamo anche i membri per mappare i nomi
        const membersResp = await fetch("/api/members");
        const members = await membersResp.json();

        logs.forEach(log => {
            // Trova nome utente associato
            let name = "Sconosciuto";
            if (log.member_id !== "Sconosciuto") {
                const m = members.find(item => item.id === log.member_id);
                if (m) name = `${m.first_name} ${m.last_name}`;
            }

            const item = document.createElement("div");
            item.className = "log-item";
            item.innerHTML = `
                <div class="log-status-indicator ${log.is_allowed ? 'allowed' : 'denied'}"></div>
                <div class="log-details">
                    <span class="log-user">${name}</span>
                    <span class="log-reason">${log.reason}</span>
                </div>
                <span class="log-time">${log.timestamp.split(" ")[1]}</span>
            `;
            container.appendChild(item);
        });
    } catch (e) {}
}


// --- AVVIO SESSIONE UTENTE AL CARICAMENTO ---
initSession();


// --- GESTIONE STAFF (RF27) ---
async function loadAdminStaffTable() {
    const tbody = document.getElementById("adminStaffTable");
    if (!tbody) return;

    try {
        const response = await fetch("/api/admin/staff");
        if (response.ok) {
            const staffList = await response.json();
            tbody.innerHTML = "";
            if (staffList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Nessun membro dello staff trovato</td></tr>';
                return;
            }
            
            staffList.forEach(staff => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${staff.username}</strong></td>
                    <td>${staff.email || '<span class="text-muted">N/A</span>'}</td>
                    <td><span class="badge badge-${staff.role === 'admin' ? 'primary' : 'secondary'}">${staff.role}</span></td>
                    <td>
                        <button class="btn btn-danger" onclick="deleteStaff('${staff.id}')" style="padding: 4px 8px; font-size: 0.8rem;">Rimuovi</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("Errore nel caricamento staff", e);
    }
}

function openStaffModal() {
    document.getElementById("formAddStaff").reset();
    document.getElementById("modalStaff").classList.add("open");
}

function closeStaffModal() {
    document.getElementById("modalStaff").classList.remove("open");
}

async function submitStaff(e) {
    e.preventDefault();
    const username = document.getElementById("staffUsername").value;
    const email = document.getElementById("staffEmail").value;
    const password = document.getElementById("staffPassword").value;
    const role = document.getElementById("staffRole").value;

    try {
        const response = await fetch("/api/admin/staff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password, role })
        });
        
        if (response.ok) {
            showToast("Membro dello staff aggiunto con successo!", "success");
            closeStaffModal();
            loadAdminStaffTable();
        } else {
            const err = await response.json();
            showToast(err.detail || "Errore nell'aggiunta dello staff", "error");
        }
    } catch (error) {
        showToast("Errore di rete", "error");
    }
}

async function deleteStaff(id) {
    customConfirm("Sei sicuro di voler rimuovere questo membro dello staff?", async () => {
        try {
            const res = await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
            if(res.ok) {
                showToast("Staff rimosso", "success");
                loadAdminStaffTable();
            } else {
                showToast("Errore eliminazione staff", "error");
            }
        } catch(e) {}
    });
}


// --- GESTIONE CORSI ADMIN (RF10) ---
let cachedCoursesList = [];

const STANDARD_TIME_SLOTS = [
    "08:00 - 09:00",
    "09:00 - 10:00",
    "10:00 - 11:00",
    "11:00 - 12:00",
    "14:00 - 15:00",
    "15:00 - 16:00",
    "16:00 - 17:00",
    "17:00 - 18:00",
    "18:00 - 19:00",
    "19:30 - 20:30"
];

const ALL_DAYS_CODES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_SHORT_IT = {
    "Mon": "Lun", "Tue": "Mar", "Wed": "Mer", "Thu": "Gio",
    "Fri": "Ven", "Sat": "Sab", "Sun": "Dom"
};

const DAY_NAMES_IT_MAP = {
    "Mon": "Lunedì", "Tue": "Martedì", "Wed": "Mercoledì", "Thu": "Giovedì",
    "Fri": "Venerdì", "Sat": "Sabato", "Sun": "Domenica"
};


function renderWeeklyScheduleConfig(weeklyScheduleData = {}, containerId = "weeklyScheduleConfigContainer", prefix = "crs") {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const defaultSlots = [
        "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
        "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00", "17:00 - 18:00",
        "18:00 - 19:00", "19:30 - 20:30"
    ];

    // Day Tabs Bar (7 columns grid, 100% width, no overflow)
    const tabsBar = document.createElement("div");
    tabsBar.style.cssText = "display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; padding: 2px 0 6px 0; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);";

    ALL_DAYS_CODES.forEach((dCode, idx) => {
        const dNameShort = DAY_SHORT_IT[dCode] || dCode;
        const activeSlots = weeklyScheduleData[dCode] || [];
        const isDayChecked = activeSlots.length > 0;

        const tabBtn = document.createElement("button");
        tabBtn.type = "button";
        tabBtn.className = `btn btn-sm ${idx === 0 ? 'btn-primary' : 'btn-secondary'}`;
        tabBtn.id = `${prefix}TabBtn_${dCode}`;
        tabBtn.style.cssText = "padding: 5px 1px; font-size: 0.75rem; border-radius: 6px; text-align: center; white-space: nowrap; width: 100%; display: flex; align-items: center; justify-content: center; gap: 2px;";
        tabBtn.innerHTML = `
            <span>${dNameShort}</span>
            <span id="${prefix}Badge_${dCode}" class="badge ${isDayChecked ? 'badge-success' : 'badge-secondary'}" style="font-size: 0.62rem; padding: 1px 4px; border-radius: 8px;">
                ${isDayChecked ? activeSlots.length : '0'}
            </span>
        `;

        tabBtn.onclick = () => switchScheduleDayTab(dCode, prefix);
        tabsBar.appendChild(tabBtn);
    });

    container.appendChild(tabsBar);

    // Day Panels
    ALL_DAYS_CODES.forEach((dCode, idx) => {
        const dayName = DAY_NAMES_IT_MAP[dCode];
        const activeSlots = weeklyScheduleData[dCode] || [];
        const isDayChecked = activeSlots.length > 0;

        const panel = document.createElement("div");
        panel.id = `${prefix}Panel_${dCode}`;
        panel.className = `${prefix}-day-panel`;
        panel.style.cssText = `background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 12px; display: ${idx === 0 ? "block" : "none"};`;

        let slotsCheckboxesHtml = defaultSlots.map(slot => {
            const isChecked = activeSlots.includes(slot);
            return `
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer; color: #e2e8f0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 5px 8px; border-radius: 6px;">
                    <input type="checkbox" class="${prefix}-slot-cb-${dCode}" value="${slot}" ${isChecked ? 'checked' : ''} onchange="updateTabBadge('${dCode}', '${prefix}')"> ${slot}
                </label>
            `;
        }).join("");

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                <label style="display: flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer; color: var(--info-color); font-size: 0.88rem;">
                    <input type="checkbox" id="${prefix}ToggleDay_${dCode}" ${isDayChecked ? 'checked' : ''} onchange="toggleDayPanelActive('${dCode}', '${prefix}')"> ${dayName}
                </label>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="selectPresetSlots('${dCode}', '${prefix}', 'all')" style="font-size: 0.72rem; padding: 2px 8px;">
                        Tutti
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="selectPresetSlots('${dCode}', '${prefix}', 'none')" style="font-size: 0.72rem; padding: 2px 8px;">
                        Nessuno
                    </button>
                </div>
            </div>
            <div id="${prefix}SlotsGrid_${dCode}" style="display: ${isDayChecked ? 'grid' : 'none'}; grid-template-columns: repeat(2, 1fr); gap: 6px; max-height: 110px; overflow-y: auto; padding-right: 4px;">
                ${slotsCheckboxesHtml}
            </div>
        `;

        container.appendChild(panel);
    });
}

function renderWellnessScheduleConfig(weeklyScheduleData = {}) {
    renderWeeklyScheduleConfig(weeklyScheduleData, "wellnessWeeklyConfigContainer", "wln");
}

function switchScheduleDayTab(selectedCode, prefix) {
    ALL_DAYS_CODES.forEach(dCode => {
        const btn = document.getElementById(`${prefix}TabBtn_${dCode}`);
        const panel = document.getElementById(`${prefix}Panel_${dCode}`);
        if (btn) {
            if (dCode === selectedCode) {
                btn.classList.remove("btn-secondary");
                btn.classList.add("btn-primary");
            } else {
                btn.classList.remove("btn-primary");
                btn.classList.add("btn-secondary");
            }
        }
        if (panel) {
            panel.style.display = dCode === selectedCode ? "block" : "none";
        }
    });
}

function toggleDayPanelActive(dCode, prefix) {
    const isChecked = document.getElementById(`${prefix}ToggleDay_${dCode}`).checked;
    const grid = document.getElementById(`${prefix}SlotsGrid_${dCode}`);
    if (grid) grid.style.display = isChecked ? "grid" : "none";
    updateTabBadge(dCode, prefix);
}

function updateTabBadge(dCode, prefix) {
    const isDayChecked = document.getElementById(`${prefix}ToggleDay_${dCode}`).checked;
    const checkedCount = document.querySelectorAll(`.${prefix}-slot-cb-${dCode}:checked`).length;
    const badge = document.getElementById(`${prefix}Badge_${dCode}`);
    if (badge) {
        badge.textContent = isDayChecked ? checkedCount : '0';
        badge.className = `badge ${isDayChecked && checkedCount > 0 ? 'badge-success' : 'badge-secondary'}`;
    }
}

function selectPresetSlots(dCode, prefix, type) {
    const toggle = document.getElementById(`${prefix}ToggleDay_${dCode}`);
    if (type === 'none') {
        if (toggle) toggle.checked = false;
        document.querySelectorAll(`.${prefix}-slot-cb-${dCode}`).forEach(cb => cb.checked = false);
    } else if (type === 'all') {
        if (toggle) toggle.checked = true;
        document.querySelectorAll(`.${prefix}-slot-cb-${dCode}`).forEach(cb => cb.checked = true);
    }
    toggleDayPanelActive(dCode, prefix);
}

window.switchScheduleDayTab = switchScheduleDayTab;
window.toggleDayPanelActive = toggleDayPanelActive;
window.updateTabBadge = updateTabBadge;
window.selectPresetSlots = selectPresetSlots;


const courseModal = document.getElementById("courseModal");
const openAddCourseBtn = document.getElementById("openAddCourseBtn");
const closeCourseModalBtn = document.getElementById("closeCourseModalBtn");
const cancelCourseBtn = document.getElementById("cancelCourseBtn");
const confirmCourseBtn = document.getElementById("confirmCourseBtn");

if (openAddCourseBtn) {
    openAddCourseBtn.addEventListener("click", () => {
        document.getElementById("courseModalTitle").textContent = "Pianifica Nuovo Corso";
        document.getElementById("courseEditId").value = "";
        document.getElementById("courseName").value = "";
        document.getElementById("courseTrainer").value = "";
        document.getElementById("courseCapacity").value = "15";

        populateSubscriptionCheckboxes("courseAllowedSubsContainer", "crs-sub-cb", null, "course");

        renderWeeklyScheduleConfig({
            "Mon": ["18:00 - 19:00"],
            "Wed": ["18:00 - 19:00"]
        });

        if (courseModal) courseModal.classList.add("open");
    });
}

if (closeCourseModalBtn) closeCourseModalBtn.addEventListener("click", () => courseModal.classList.remove("open"));
if (cancelCourseBtn) cancelCourseBtn.addEventListener("click", () => courseModal.classList.remove("open"));

if (confirmCourseBtn) {
    confirmCourseBtn.addEventListener("click", async () => {
        const courseId = document.getElementById("courseEditId").value;
        const name = document.getElementById("courseName").value.trim();
        const trainer = document.getElementById("courseTrainer").value.trim();
        const max_capacity = parseInt(document.getElementById("courseCapacity").value);

        const weekly_schedule = {};
        ALL_DAYS_CODES.forEach(dCode => {
            const toggle = document.getElementById(`crsToggleDay_${dCode}`);
            if (toggle && toggle.checked) {
                const checkedSlots = [];
                document.querySelectorAll(`.crs-slot-cb-${dCode}:checked`).forEach(cb => {
                    checkedSlots.push(cb.value);
                });
                if (checkedSlots.length > 0) {
                    weekly_schedule[dCode] = checkedSlots;
                }
            }
        });

        if (!name || !trainer || Object.keys(weekly_schedule).length === 0 || isNaN(max_capacity) || max_capacity <= 0) {
            showToast("Compila nome, istruttore e seleziona almeno un giorno con almeno una fascia oraria.", "error");
            return;
        }

        const allowed_subscriptions = Array.from(document.querySelectorAll(".crs-sub-cb:checked")).map(cb => cb.value);

        const payload = {
            name,
            trainer,
            weekly_schedule,
            max_capacity,
            allowed_subscriptions
        };

        try {
            const url = courseId ? `/api/courses?course_id=${courseId}` : "/api/courses";
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast("Corso salvato con successo!", "success");
                courseModal.classList.remove("open");
                loadAdminDashboard();
                loadCoursesDropdown();
                initClientDatePicker();
    loadClientCoursesCards();
    loadClientWellnessCards();
    loadWellnessDropdown();
            } else {
                const err = await response.json();
                showToast(err.detail || "Errore durante il salvataggio del corso", "error");
            }
        } catch (e) {
            showToast("Errore di connessione al server", "error");
        }
    });
}

async function loadAdminCoursesTable() {
    try {
        const response = await fetch("/api/courses");
        const courses = await response.json();
        cachedCoursesList = courses;
        const tbody = document.getElementById("adminCoursesTable");
        if (!tbody) return;
        tbody.innerHTML = "";

        courses.forEach(c => {
            const tr = document.createElement("tr");
            const subsBadges = (c.allowed_subscriptions || []).map(s => `<span class="badge badge-secondary" style="font-size: 0.7rem; margin-right: 2px; text-transform: uppercase;">${s}</span>`).join("") || "Tutti";
            const courseJsonStr = encodeURIComponent(JSON.stringify(c));
            tr.innerHTML = `
                <td><strong>${c.name}</strong></td>
                <td>${c.trainer}</td>
                <td>${renderAdminScheduleCell(c.weekly_schedule)}</td>
                <td><span class="badge badge-info">${c.max_capacity} posti</span></td>
                <td>${subsBadges}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editCourseFromJSON('${courseJsonStr}')" title="Modifica">
                        <i class="fa-solid fa-pen"></i> Modifica
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCourse('${c.id}')" title="Elimina">
                        <i class="fa-solid fa-trash"></i> Elimina
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Errore caricamento corsi admin", e);
    }
}

function editCourseFromJSON(encodedJson) {
    const c = JSON.parse(decodeURIComponent(encodedJson));
    document.getElementById("courseModalTitle").textContent = "Modifica Corso";
    document.getElementById("courseEditId").value = c.id;
    document.getElementById("courseName").value = c.name;
    document.getElementById("courseTrainer").value = c.trainer;
    document.getElementById("courseCapacity").value = c.max_capacity;

    const subs = c.allowed_subscriptions || [];
    populateSubscriptionCheckboxes("courseAllowedSubsContainer", "crs-sub-cb", subs);

    renderWeeklyScheduleConfig(c.weekly_schedule || {});

    if (courseModal) courseModal.classList.add("open");
}

async function deleteCourse(id) {
    customConfirm("Sei sicuro di voler eliminare questo corso?", async () => {
        try {
            const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
            if(res.ok) {
                showToast("Corso eliminato", "success");
                loadAdminDashboard();
            } else {
                showToast("Errore eliminazione corso", "error");
            }
        } catch(e) {}
    });
}

window.editCourseFromJSON = editCourseFromJSON;
window.deleteCourse = deleteCourse;

// --- ASSISTENZA DINAMICA PRENOTAZIONI CORSO E POSTI (RF11 & RF12) ---
async function loadCoursesDropdown() {
    try {
        const response = await fetch("/api/courses");
        const courses = await response.json();
        cachedCoursesList = courses;
        const optgroup = document.getElementById("bookingCoursesOptGroup");
        if (!optgroup) return;
        optgroup.innerHTML = "";

        courses.forEach(c => {
            const opt = document.createElement("option");
            opt.value = `course:${c.id}`;
            opt.textContent = `${c.name}`;
            optgroup.appendChild(opt);
        });
    } catch (e) {}
}

const bookingServiceSelect = document.getElementById("bookingService");
const bookingDateInput = document.getElementById("bookingDate");
const bookingTimeSlotSelect = document.getElementById("bookingTimeSlot");
const bookingCourseHint = document.getElementById("bookingCourseHint");

function updateTimeSlotsForSelectedDateAndCourse() {
    const serviceVal = bookingServiceSelect ? bookingServiceSelect.value : "";
    if (!serviceVal) {
        if (bookingCourseHint) bookingCourseHint.style.display = "none";
        return;
    }

    let serviceName = "";
    let ws = {};

    if (serviceVal.startsWith("course:")) {
        const courseId = serviceVal.split(":")[1];
        const course = cachedCoursesList.find(c => c.id === courseId);
        if (!course) return;
        serviceName = course.name;
        ws = course.weekly_schedule || {};
    } else if (serviceVal.startsWith("wellness:")) {
        const wellnessId = serviceVal.split(":")[1];
        const wellness = cachedWellnessList.find(w => w.id === wellnessId);
        if (!wellness) return;
        serviceName = wellness.name;
        ws = wellness.weekly_schedule || {};
    } else {
        if (bookingCourseHint) bookingCourseHint.style.display = "none";
        return;
    }

    // 1. Renderizza l'avviso completo e formattato del palinsesto
    if (bookingCourseHint) {
        bookingCourseHint.style.display = "block";
        let scheduleItems = "";
        ALL_DAYS_CODES.forEach(dCode => {
            if (ws[dCode] && ws[dCode].length > 0) {
                scheduleItems += `<li><strong>${DAY_NAMES_IT_MAP[dCode]}</strong>: ${ws[dCode].join(', ')}</li>`;
            }
        });
        bookingCourseHint.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 6px; color: #fff; font-size: 0.95rem;">
                <i class="fa-solid fa-calendar-days" style="color: var(--primary-color); margin-right: 6px;"></i> Programmazione Orari: <strong>${serviceName}</strong>
            </div>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.6; font-size: 0.88rem;">
                ${scheduleItems || '<li>Nessun orario definito</li>'}
            </ul>
        `;
    }

    // 2. Aggiorna lo slot orario in base alla data selezionata
    const pickedDateStr = bookingDateInput ? bookingDateInput.value : "";
    if (!pickedDateStr || !bookingTimeSlotSelect) return;

    const dateParts = pickedDateStr.split("-");
    const pickedDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dayCodes = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const pickedDayCode = dayCodes[pickedDate.getDay()];

    const allowedSlots = ws[pickedDayCode] || [];

    // Rigenera la tendina delle fasce orarie con solo quelle valide per quel giorno
    bookingTimeSlotSelect.innerHTML = "";
    if (allowedSlots.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Nessun orario in questo giorno";
        bookingTimeSlotSelect.appendChild(opt);
        showToast(`Attenzione: '${serviceName}' non è in programma di ${DAY_NAMES_IT_MAP[pickedDayCode] || pickedDayCode}.`, "warning");
    } else {
        allowedSlots.forEach(slot => {
            const opt = document.createElement("option");
            opt.value = slot;
            opt.textContent = slot;
            bookingTimeSlotSelect.appendChild(opt);
        });
        bookingTimeSlotSelect.value = allowedSlots[0];
    }
}

if (bookingServiceSelect) {
    bookingServiceSelect.addEventListener("change", () => updateTimeSlotsForSelectedDateAndCourse());
}

if (bookingDateInput) {
    bookingDateInput.addEventListener("change", () => updateTimeSlotsForSelectedDateAndCourse());
}

function getValidClientSelectedDate() {
    const filterDateInput = document.getElementById("courseFilterDate");
    const todayStr = new Date().toISOString().split("T")[0];
    if (!filterDateInput) return todayStr;

    if (!filterDateInput.value || !filterDateInput.value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        filterDateInput.value = todayStr;
        return todayStr;
    }
    return filterDateInput.value;
}

function initClientDatePicker() {
    const filterDateInput = document.getElementById("courseFilterDate");
    const todayStr = new Date().toISOString().split("T")[0];
    if (filterDateInput) {
        if (!filterDateInput.value) filterDateInput.value = todayStr;
        filterDateInput.min = todayStr;
        filterDateInput.onchange = () => {
            const dateVal = getValidClientSelectedDate();
            const bookingDateInput = document.getElementById("bookingDate");
            if (bookingDateInput) {
                bookingDateInput.value = dateVal;
                bookingDateInput.dispatchEvent(new Event("change"));
            }
            loadClientCoursesCards();
            loadClientWellnessCards();
        };
    }
}

async function loadClientCoursesCards() {
    const grid = document.getElementById("clientCoursesGrid");
    if (!grid) return;

    const targetDate = getValidClientSelectedDate();

    try {
        const response = await fetch(`/api/courses?date=${targetDate}`);
        const courses = await response.json();
        cachedCoursesList = courses;
        grid.innerHTML = "";

        if (courses.length === 0) {
            grid.innerHTML = `<p class="text-muted">Nessun corso in programma per la data selezionata.</p>`;
            return;
        }

        const dateParts = targetDate.split("-");
        const pickedDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        const dayCodes = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const targetDayCode = dayCodes[pickedDate.getDay()];
        const targetDayName = DAY_NAMES_IT_MAP[targetDayCode] || targetDayCode;

        courses.forEach(c => {
            const allowedBadges = (c.allowed_subscriptions || []).map(s => 
                `<span class="badge badge-secondary" style="font-size: 0.75rem; text-transform: uppercase;">${s}</span>`
            ).join(" ");

            const slotAvail = c.slot_availabilities || {};
            const slotsEntries = Object.entries(slotAvail);

            let slotsHtml = "";
            if (slotsEntries.length === 0) {
                slotsHtml = `
                    <div style="padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center; color: var(--text-muted); font-size: 0.85rem; border: 1px dashed rgba(255,255,255,0.1);">
                        <i class="fa-solid fa-circle-info" style="margin-right: 4px;"></i> Non in programma per <strong>${targetDayName}</strong>
                    </div>
                `;
            } else {
                slotsHtml = slotsEntries.map(([slot, info]) => {
                    const isFull = info.available_seats <= 0;
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; margin-bottom: 8px;">
                            <div>
                                <div style="font-weight: 600; font-size: 0.88rem; color: #fff;">
                                    <i class="fa-solid fa-clock" style="color: var(--info-color); margin-right: 4px;"></i> ${slot}
                                </div>
                                <div style="font-size: 0.8rem; margin-top: 2px;">
                                    <span class="badge ${isFull ? 'badge-danger' : 'badge-success'}" style="font-size: 0.75rem; padding: 3px 8px;">
                                        <i class="fa-solid ${isFull ? 'fa-user-slash' : 'fa-users'}" style="margin-right: 3px;"></i>
                                        ${isFull ? 'Esaurito (0 posti)' : `${info.available_seats} / ${info.max_capacity} posti liberi`}
                                    </span>
                                </div>
                            </div>
                            <button class="btn ${isFull ? 'btn-secondary' : 'btn-primary'} btn-sm" ${isFull ? 'disabled' : ''} onclick="quickBookCourse('course:${c.id}', '${targetDate}', '${slot}')" style="padding: 6px 12px; font-size: 0.8rem;">
                                <i class="fa-solid ${isFull ? 'fa-lock' : 'fa-calendar-check'}"></i> ${isFull ? 'Completo' : 'Prenota'}
                            </button>
                        </div>
                    `;
                }).join("");
            }

            const card = document.createElement("div");
            card.className = "glass-card padding-20 course-card";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.justifyContent = "space-between";

            card.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <h3 style="font-size: 1.15rem; font-weight: 700; color: #fff; margin: 0;">${c.name}</h3>
                        <div>${allowedBadges}</div>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">
                        <i class="fa-solid fa-user-ninja" style="color: var(--primary-color);"></i> Istruttore: <strong>${c.trainer}</strong>
                    </p>
                </div>
                <div>
                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 10px;">
                        Disponibilità per ${targetDayName} (${targetDate}):
                    </div>
                    ${slotsHtml}
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error("Errore caricamento schede corsi", e);
    }
}

function quickBookCourse(courseServiceVal, dateVal) {
    const select = document.getElementById("bookingService");
    const dateInput = document.getElementById("bookingDate");
    
    if (select) select.value = courseServiceVal;
    if (dateInput) dateInput.value = dateVal;

    updateTimeSlotsForSelectedDateAndCourse();

    const bookingSection = document.querySelector(".client-booking-section");
    if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: "smooth" });
        showToast("Corso e data selezionati! Scegli l'orario e clicca su Conferma Prenotazione.", "info");
    }
}

window.quickBookCourse = quickBookCourse;


// --- GESTIONE SERVIZI BENESSERE ADMIN (RF28) ---
let cachedWellnessList = [];



const wellnessModal = document.getElementById("wellnessModal");
const openAddWellnessBtn = document.getElementById("openAddWellnessBtn");
const closeWellnessModalBtn = document.getElementById("closeWellnessModalBtn");
const cancelWellnessBtn = document.getElementById("cancelWellnessBtn");
const confirmWellnessBtn = document.getElementById("confirmWellnessBtn");

if (openAddWellnessBtn) {
    openAddWellnessBtn.addEventListener("click", () => {
        document.getElementById("wellnessModalTitle").textContent = "Configura Servizio Benessere";
        document.getElementById("wellnessEditId").value = "";
        document.getElementById("wellnessName").value = "";
        document.getElementById("wellnessPrice").value = "10.00";
        document.getElementById("wellnessCapacity").value = "4";

        populateSubscriptionCheckboxes("wellnessFreeSubsContainer", "wln-sub-cb", null, "wellness");

        const defaultSlots = [
            "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
            "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00", "17:00 - 18:00",
            "18:00 - 19:00", "19:30 - 20:30"
        ];
        const stdSchedule = {};
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(d => stdSchedule[d] = defaultSlots);

        renderWellnessScheduleConfig(stdSchedule);

        if (wellnessModal) wellnessModal.classList.add("open");
    });
}

if (closeWellnessModalBtn) closeWellnessModalBtn.addEventListener("click", () => wellnessModal.classList.remove("open"));
if (cancelWellnessBtn) cancelWellnessBtn.addEventListener("click", () => wellnessModal.classList.remove("open"));

if (confirmWellnessBtn) {
    confirmWellnessBtn.addEventListener("click", async () => {
        const serviceId = document.getElementById("wellnessEditId").value;
        const name = document.getElementById("wellnessName").value.trim();
        const price = parseFloat(document.getElementById("wellnessPrice").value);
        const max_capacity = parseInt(document.getElementById("wellnessCapacity").value);

        const weekly_schedule = {};
        ALL_DAYS_CODES.forEach(dCode => {
            const toggle = document.getElementById(`wlnToggleDay_${dCode}`);
            if (toggle && toggle.checked) {
                const checkedSlots = [];
                document.querySelectorAll(`.wln-slot-cb-${dCode}:checked`).forEach(cb => {
                    checkedSlots.push(cb.value);
                });
                if (checkedSlots.length > 0) {
                    weekly_schedule[dCode] = checkedSlots;
                }
            }
        });

        if (!name || isNaN(price) || price < 0 || Object.keys(weekly_schedule).length === 0 || isNaN(max_capacity) || max_capacity <= 0) {
            showToast("Compila nome, prezzo, capienza e seleziona almeno un giorno con orari.", "error");
            return;
        }

        const free_for_subscriptions = Array.from(document.querySelectorAll(".wln-sub-cb:checked")).map(cb => cb.value);

        const payload = {
            name,
            price,
            weekly_schedule,
            max_capacity,
            free_for_subscriptions
        };

        try {
            const url = serviceId ? `/api/wellness-services?service_id=${serviceId}` : "/api/wellness-services";
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast("Servizio benessere salvato con successo!", "success");
                wellnessModal.classList.remove("open");
                loadAdminDashboard();
                loadWellnessDropdown();
                loadClientWellnessCards();
            } else {
                const err = await response.json();
                showToast(err.detail || "Errore durante il salvataggio del servizio", "error");
            }
        } catch (e) {
            showToast("Errore di connessione al server", "error");
        }
    });
}

async function loadAdminWellnessTable() {
    try {
        const response = await fetch("/api/wellness-services");
        const services = await response.json();
        cachedWellnessList = services;
        const tbody = document.getElementById("adminWellnessTable");
        if (!tbody) return;
        tbody.innerHTML = "";

        services.forEach(s => {
            const tr = document.createElement("tr");
            const freeBadges = (s.free_for_subscriptions || []).map(sub => `<span class="badge badge-success" style="font-size: 0.7rem; margin-right: 2px; text-transform: uppercase;">${sub}</span>`).join("") || "Nessuno";
            const jsonStr = encodeURIComponent(JSON.stringify(s));
            tr.innerHTML = `
                <td><strong>${s.name}</strong></td>
                <td>${s.price.toFixed(2)} €</td>
                <td><span class="badge badge-info">${s.max_capacity} posti</span></td>
                <td>${freeBadges}</td>
                <td>${renderAdminScheduleCell(s.weekly_schedule)}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editWellnessFromJSON('${jsonStr}')" title="Modifica">
                        <i class="fa-solid fa-pen"></i> Modifica
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteWellness('${s.id}')" title="Elimina">
                        <i class="fa-solid fa-trash"></i> Elimina
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Errore caricamento servizi benessere admin", e);
    }
}

function editWellnessFromJSON(encodedJson) {
    const s = JSON.parse(decodeURIComponent(encodedJson));
    document.getElementById("wellnessModalTitle").textContent = "Modifica Servizio Benessere";
    document.getElementById("wellnessEditId").value = s.id;
    document.getElementById("wellnessName").value = s.name;
    document.getElementById("wellnessPrice").value = s.price;
    document.getElementById("wellnessCapacity").value = s.max_capacity;

    const freeSubs = s.free_for_subscriptions || [];
    populateSubscriptionCheckboxes("wellnessFreeSubsContainer", "wln-sub-cb", freeSubs);

    renderWellnessScheduleConfig(s.weekly_schedule || {});

    if (wellnessModal) wellnessModal.classList.add("open");
}

async function deleteWellnessService(serviceId) {
    customConfirm("Sei sicuro di voler eliminare questo servizio benessere?", async () => {
        try {
            const response = await fetch(`/api/wellness-services/${serviceId}`, { method: "DELETE" });
            if (response.ok) {
                showToast("Servizio benessere eliminato con successo!", "success");
                loadAdminDashboard();
                loadWellnessDropdown();
                loadClientWellnessCards();
            } else {
                const err = await response.json();
                showToast(err.detail || "Errore eliminazione servizio", "error");
            }
        } catch (e) {
            showToast("Errore di connessione al server", "error");
        }
    });
}

window.editWellnessFromJSON = editWellnessFromJSON;
window.deleteWellnessService = deleteWellnessService;

async function loadWellnessDropdown() {
    try {
        const response = await fetch("/api/wellness-services");
        const services = await response.json();
        cachedWellnessList = services;

        const select = document.getElementById("bookingService");
        if (!select) return;

        let optgroup = select.querySelector("optgroup[label='Servizi Benessere']");
        if (!optgroup) {
            optgroup = document.createElement("optgroup");
            optgroup.label = "Servizi Benessere";
            select.insertBefore(optgroup, select.firstChild);
        }
        optgroup.innerHTML = "";

        services.forEach(s => {
            const opt = document.createElement("option");
            opt.value = `wellness:${s.id}`;
            const priceLabel = s.price > 0 ? `${s.price.toFixed(2)}€` : 'Gratis';
            const freeLabel = (s.free_for_subscriptions || []).length > 0 ? ` - Gratis per ${s.free_for_subscriptions.join(', ').toUpperCase()}` : '';
            opt.textContent = `${s.name} (${priceLabel}${freeLabel})`;
            optgroup.appendChild(opt);
        });
    } catch (e) {}
}

async function loadClientWellnessCards() {
    const grid = document.getElementById("clientWellnessGrid");
    if (!grid) return;

    const targetDate = getValidClientSelectedDate();

    try {
        const response = await fetch(`/api/wellness-services?date=${targetDate}`);
        const services = await response.json();
        cachedWellnessList = services;
        grid.innerHTML = "";

        if (services.length === 0) {
            grid.innerHTML = `<p class="text-muted">Nessun servizio benessere disponibile per la data selezionata.</p>`;
            return;
        }

        const dateParts = targetDate.split("-");
        const pickedDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        const dayCodes = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const targetDayCode = dayCodes[pickedDate.getDay()];
        const targetDayName = DAY_NAMES_IT_MAP[targetDayCode] || targetDayCode;

        services.forEach(s => {
            const freeBadge = (s.free_for_subscriptions || []).length > 0 
                ? `<span class="badge badge-success" style="font-size: 0.75rem;">GRATIS PER ${s.free_for_subscriptions.join(', ').toUpperCase()}</span>` 
                : `<span class="badge badge-secondary" style="font-size: 0.75rem;">${s.price.toFixed(2)} €</span>`;

            const slotAvail = s.slot_availabilities || {};
            const slotsEntries = Object.entries(slotAvail);

            let slotsHtml = "";
            if (slotsEntries.length === 0) {
                slotsHtml = `
                    <div style="padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center; color: var(--text-muted); font-size: 0.85rem; border: 1px dashed rgba(255,255,255,0.1);">
                        <i class="fa-solid fa-circle-info" style="margin-right: 4px;"></i> Non disponibile di <strong>${targetDayName}</strong>
                    </div>
                `;
            } else {
                slotsHtml = slotsEntries.map(([slot, info]) => {
                    const isFull = info.available_seats <= 0;
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; margin-bottom: 8px;">
                            <div>
                                <div style="font-weight: 600; font-size: 0.88rem; color: #fff;">
                                    <i class="fa-solid fa-clock" style="color: var(--info-color); margin-right: 4px;"></i> ${slot}
                                </div>
                                <div style="font-size: 0.8rem; margin-top: 2px;">
                                    <span class="badge ${isFull ? 'badge-danger' : 'badge-success'}" style="font-size: 0.75rem; padding: 3px 8px;">
                                        <i class="fa-solid ${isFull ? 'fa-user-slash' : 'fa-users'}" style="margin-right: 3px;"></i>
                                        ${isFull ? 'Esaurito (0 posti)' : `${info.available_seats} / ${info.max_capacity} posti liberi`}
                                    </span>
                                </div>
                            </div>
                            <button class="btn ${isFull ? 'btn-secondary' : 'btn-primary'} btn-sm" ${isFull ? 'disabled' : ''} onclick="quickBookWellness('wellness:${s.id}', '${targetDate}', '${slot}')" style="padding: 6px 12px; font-size: 0.8rem;">
                                <i class="fa-solid ${isFull ? 'fa-lock' : 'fa-calendar-check'}"></i> ${isFull ? 'Completo' : 'Prenota'}
                            </button>
                        </div>
                    `;
                }).join("");
            }

            const card = document.createElement("div");
            card.className = "glass-card padding-20 course-card";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.justifyContent = "space-between";

            card.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <h3 style="font-size: 1.15rem; font-weight: 700; color: #fff; margin: 0;">${s.name}</h3>
                        <div>${freeBadge}</div>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">
                        <i class="fa-solid fa-tag" style="color: var(--warning-color);"></i> Prezzo Base: <strong>${s.price.toFixed(2)} €</strong>
                    </p>
                </div>
                <div>
                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 10px;">
                        Disponibilità per ${targetDayName} (${targetDate}):
                    </div>
                    ${slotsHtml}
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error("Errore caricamento schede benessere", e);
    }
}

function quickBookWellness(wellnessServiceVal, dateVal, timeSlotVal) {
    const select = document.getElementById("bookingService");
    const dateInput = document.getElementById("bookingDate");
    const slotSelect = document.getElementById("bookingTimeSlot");

    if (select) select.value = wellnessServiceVal;
    if (dateInput) dateInput.value = dateVal;

    updateTimeSlotsForSelectedDateAndCourse();

    if (slotSelect && timeSlotVal) slotSelect.value = timeSlotVal;

    const bookingSection = document.querySelector(".client-booking-section");
    if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: "smooth" });
        showToast("Servizio Benessere e orario selezionati! Clicca su Conferma Prenotazione.", "info");
    }
}

window.quickBookWellness = quickBookWellness;

function formatScheduleDropdownHTML(weeklyScheduleObj) {
    if (!weeklyScheduleObj || Object.keys(weeklyScheduleObj).length === 0) {
        return `<span class="badge badge-secondary" style="font-size: 0.75rem;">Nessun orario</span>`;
    }
    
    const dayEntries = Object.entries(weeklyScheduleObj);
    const dayCount = dayEntries.length;
    
    let optionsHtml = dayEntries.map(([dCode, slots]) => {
        const dName = DAY_NAMES_IT_MAP[dCode] || dCode;
        const slotsStr = slots.join(", ");
        return `<option value="" disabled>📅 ${dName}: ${slotsStr}</option>`;
    }).join("");

    return `
        <select onclick="event.stopPropagation();" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: var(--info-color); border-radius: 8px; padding: 6px 12px; font-size: 0.82rem; font-weight: 600; cursor: pointer; max-width: 220px; outline: none; transition: all 0.2s ease;">
            <option value="" disabled selected>🕒 Orari (${dayCount} giorn${dayCount === 1 ? 'o' : 'i'}) ▾</option>
            ${optionsHtml}
        </select>
    `;
}
