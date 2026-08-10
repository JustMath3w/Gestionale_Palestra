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
    }, 4000);
}

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
            document.getElementById("cancelActiveSubBtn").addEventListener("click", cancelActiveSubscription);
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
}

// Disdici Abbonamento Attivo
async function cancelActiveSubscription() {
    if (!currentMember) return;
    if (!confirm("Sei sicuro di voler disdire il tuo abbonamento attivo? Non potrai più effettuare il check-in finché non ne acquisterai uno nuovo.")) return;

    try {
        const response = await fetch(`/api/members/${currentMember.id}/subscriptions/cancel`, {
            method: "POST"
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Errore disdetta abbonamento");
        }

        showToast("Abbonamento disdetto con successo!", "success");
        loadClientDashboard();
    } catch (err) {
        showToast(err.message, "error");
    }
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
            const err = await response.json();
            throw new Error(err.detail || "Errore acquisto abbonamento");
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
            const err = await response.json();
            throw new Error(err.detail || "Errore di prenotazione");
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

        // Carichiamo anche i corsi per mappare i nomi
        const coursesResp = await fetch("/api/courses");
        const courses = await coursesResp.json();

        bookings.forEach(b => {
            let serviceName = b.service_type;
            if (b.service_type === "sauna") serviceName = "Sauna Relax 🧖‍♂️";
            else if (b.service_type === "massage_chair") serviceName = "Poltrona Massaggio 🪑";
            else if (b.service_type.startsWith("course:")) {
                const cId = b.service_type.split(":")[1];
                const c = courses.find(item => item.id === cId);
                serviceName = c ? `${c.name} 🏋️‍♂️` : "Corso Gruppo";
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
    if (!confirm("Sei sicuro di voler cancellare questa prenotazione? Eventuali rimborsi saranno accreditati sul portafoglio.")) return;
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
            const err = await response.json();
            throw new Error(err.detail || "Errore di acquisto");
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
        // 1. Statistiche finanziarie e di gradimento
        const response = await fetch("/api/admin/stats");
        const stats = await response.json();

        document.getElementById("statTotalRevenue").textContent = `${stats.financials.total.toFixed(2)} €`;
        document.getElementById("statSubRevenue").textContent = `${stats.financials.subscriptions.toFixed(2)} €`;
        document.getElementById("statBarRevenue").textContent = `${stats.financials.bar.toFixed(2)} €`;
        document.getElementById("statServicesRevenue").textContent = `${stats.financials.services.toFixed(2)} €`;

        // Inizializza o aggiorna Grafico Affluenza
        initAffluenceChart(stats.affluence);

        // Inizializza o aggiorna Grafico Popolarità
        initPopularityChart(stats.popularity);

        // 2. Anagrafica Utenti
        loadAdminMembersTable();

        // 3. Tipologie Abbonamento (RF6)
        loadAdminSubTypesTable();

        // 4. Storico Sottoscrizioni
        loadSubscriptionHistory();

        // 5. Catalogo Prodotti (RF18)
        loadAdminProductsTable();
    } catch (e) {
        console.error("Errore caricamento statistiche admin", e);
    }
}

// Inizializza grafico affluenza
function initAffluenceChart(affluenceData) {
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
                label: "Ingressi Convalidati",
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
}

// Inizializza grafico popolarità
function initPopularityChart(popularityData) {
    const ctx = document.getElementById("popularityChart").getContext("2d");
    
    // Combiniamo servizi e corsi popolari per renderizzarli in un unico grafico a barre
    const labels = [];
    const values = [];

    // Mappatura nomi servizi benessere
    labels.push("Sauna", "Poltrona Massaggio");
    values.push(popularityData.services.sauna || 0, popularityData.services.massage_chair || 0);

    // Corsi
    for (const [courseName, count] of Object.entries(popularityData.courses)) {
        labels.push(courseName);
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
                    <button class="btn ${m.is_active ? 'btn-danger' : 'btn-success'} btn-sm" onclick="adminToggleStatus('${m.id}')" title="${m.is_active ? 'Sospendi Account' : 'Attiva Account'}">
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

async function adminToggleStatus(memberId) {
    if (!confirm("Sei sicuro di voler modificare lo stato di attivazione di questo account?")) return;

    try {
        const response = await fetch(`/api/members/${memberId}/toggle-status`, {
            method: "POST"
        });
        if (response.ok) {
            showToast("Stato account aggiornato con successo!", "success");
            loadAdminDashboard();
        } else {
            showToast("Impossibile modificare lo stato dell'account", "error");
        }
    } catch (e) {}
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
        
        // Deseleziona tutti i servizi
        document.getElementById("srvSalaPesi").checked = false;
        document.getElementById("srvCorsi").checked = false;
        document.getElementById("srvSauna").checked = false;
        document.getElementById("srvPoltrona").checked = false;
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

        // Costruisci l'elenco dei servizi selezionati
        const services = [];
        if (document.getElementById("srvSalaPesi").checked) services.push("sala_pesi");
        if (document.getElementById("srvCorsi").checked) services.push("corsi");
        if (document.getElementById("srvSauna").checked) services.push("sauna");
        if (document.getElementById("srvPoltrona").checked) services.push("poltrona_massaggio");
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
                <td>${st.services.map(s => `<span class="badge badge-secondary" style="font-size: 0.7rem; margin-right: 2px;">${s}</span>`).join('') || 'Nessuno'}</td>
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
    document.getElementById("srvSauna").checked = services.includes("sauna");
    document.getElementById("srvPoltrona").checked = services.includes("poltrona_massaggio");
    document.getElementById("srvBevande").checked = services.includes("bevande");

    subTypeModal.classList.add("open");
}

// Rimuovi tipologia di abbonamento (RF6 - Delete)
async function deleteSubType(subTypeId) {
    if (!confirm(`Sei sicuro di voler eliminare la tipologia di abbonamento '${subTypeId}'? Questa azione non può essere annullata.`)) return;

    try {
        const response = await fetch(`/api/subscriptions/types/${subTypeId}`, {
            method: "DELETE"
        });

        if (response.ok) {
            showToast("Tipologia abbonamento rimossa con successo!", "success");
            loadAdminDashboard();
        } else {
            const err = await response.json();
            showToast(err.detail || "Errore durante l'eliminazione", "error");
        }
    } catch (e) {
        showToast("Errore di connessione al server", "error");
    }
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

window.deleteProduct = async function(id) {
    if (!confirm("Sei sicuro di voler eliminare questo prodotto dal catalogo?")) return;
    try {
        const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
        if (response.ok) {
            showToast("Prodotto rimosso con successo", "success");
            loadAdminProductsTable();
        } else {
            showToast("Errore nell'eliminazione", "error");
        }
    } catch (e) {
        showToast("Errore di connessione", "error");
    }
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
