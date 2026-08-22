import re

with open("static/index.html", "r", encoding="utf-8") as f:
    html = f.read()

# ----------------- ADMIN VIEW -----------------
s_fin = "                    <!-- REPORT FINANZIARI GENERALI -->"
s_staff = "                    <!-- GESTIONE STAFF (RF27) -->"
s_users = "                    <!-- GESTIONE UTENTI -->"
s_subs = "                    <!-- GESTIONE ABBONAMENTI (RF6) -->"
s_courses = "                    <!-- GESTIONE CORSI (RF10) -->"
s_history = "                    <!-- STORICO SOTTOSCRIZIONI -->"
s_products = "                    <!-- GESTIONE CATALOGO PRODOTTI (RF18) -->"
s_wellness = "                    <!-- GESTIONE SERVIZI BENESSERE (RF28) -->"
s_end_admin = "                </div>\n            </section>\n\n            <!-- TAB 3: TORNELLO DI INGRESSO -->"

pre_admin = html.split(s_fin)[0]
p_fin_staff = html.split(s_fin)[1].split(s_staff)[0]
p_staff_users = html.split(s_staff)[1].split(s_users)[0]
p_users_subs = html.split(s_users)[1].split(s_subs)[0]
p_subs_courses = html.split(s_subs)[1].split(s_courses)[0]
p_courses_hist = html.split(s_courses)[1].split(s_history)[0]
p_hist_prod = html.split(s_history)[1].split(s_products)[0]
p_prod_well = html.split(s_products)[1].split(s_wellness)[0]

# IMPORTANT: p_well_end must NOT include the closing </section>
p_well_end_full = html.split(s_wellness)[1].split(s_end_admin)[0]
# It currently has "                </div>\n" at the end of it which belongs to adminDashboardContainer
# Actually, the last closing tag before s_end_admin is </div> for the wellness grid.

post_admin = s_end_admin + html.split(s_end_admin)[1]

admin_nav = """                    <!-- Admin Sub-tabs Navigation -->
                    <div class="admin-subtabs-nav">
                        <button class="admin-subtab active" onclick="switchAdminTab('dashboard')"><i class="fa-solid fa-chart-pie"></i> Dashboard</button>
                        <button class="admin-subtab" onclick="switchAdminTab('users')"><i class="fa-solid fa-users"></i> Utenti & Staff</button>
                        <button class="admin-subtab" onclick="switchAdminTab('activities')"><i class="fa-solid fa-dumbbell"></i> Attività</button>
                        <button class="admin-subtab" onclick="switchAdminTab('shop')"><i class="fa-solid fa-store"></i> Negozio & Abbonamenti</button>
                    </div>

"""

dashboard_html = f'                    <div class="admin-subtab-pane active" id="admin-dashboard">\n{s_fin}{p_fin_staff}                    </div>\n'
users_html = f'                    <div class="admin-subtab-pane" id="admin-users" style="display:none;">\n{s_users}{p_users_subs}{s_staff}{p_staff_users}                    </div>\n'
activities_html = f'                    <div class="admin-subtab-pane" id="admin-activities" style="display:none;">\n{s_courses}{p_courses_hist}{s_wellness}{p_well_end_full}                    </div>\n'
shop_html = f'                    <div class="admin-subtab-pane" id="admin-shop" style="display:none;">\n{s_subs}{p_subs_courses}{s_products}{p_prod_well}{s_history}{p_hist_prod}                    </div>\n'

html = pre_admin + admin_nav + dashboard_html + users_html + activities_html + shop_html + post_admin


# ----------------- CLIENT VIEW -----------------
s_cards = "                <!-- CARTE DI RIEPILOGO CLIENTE -->"
s_pal_corsi = "                <!-- PALINSESTO CORSI E DISPONIBILITA POSTI (RF11 & RF12) -->"
s_pal_well = "                <!-- PALINSESTO SERVIZI BENESSERE (RF28) -->"
s_subs = "                <!-- SEZIONE ABBONAMENTI DISPONIBILI -->"
s_prenot = "                <!-- PRENOTAZIONE CORSI E SERVIZI -->"
s_bar = "                <!-- SMART BAR -->"
s_end_client = "                </div>\n            </section>\n\n            <!-- TAB 2: VISTA ADMIN -->"

pre_client = html.split(s_cards)[0]
p_cards_pal = html.split(s_cards)[1].split(s_pal_corsi)[0]
p_pal_well = html.split(s_pal_corsi)[1].split(s_pal_well)[0]
p_well_subs = html.split(s_pal_well)[1].split(s_subs)[0]
p_subs_prenot = html.split(s_subs)[1].split(s_prenot)[0]
p_prenot_bar = html.split(s_prenot)[1].split(s_bar)[0]
p_bar_end_full = html.split(s_bar)[1].split(s_end_client)[0]

post_client = s_end_client + html.split(s_end_client)[1]

client_nav = """                <!-- Client Sub-tabs Navigation -->
                <div class="client-subtabs-nav admin-subtabs-nav">
                    <button class="client-subtab admin-subtab active" onclick="switchClientTab('dashboard')"><i class="fa-solid fa-house-user"></i> Riepilogo & Acquisti</button>
                    <button class="client-subtab admin-subtab" onclick="switchClientTab('activities')"><i class="fa-solid fa-calendar-check"></i> Corsi & Prenotazioni</button>
                </div>

"""

# Merged dashboard and shop!
client_dashboard_html = f'                <div class="client-subtab-pane active" id="client-dashboard">\n{s_cards}{p_cards_pal}{s_subs}{p_subs_prenot}{s_bar}{p_bar_end_full}                </div>\n'
client_activities_html = f'                <div class="client-subtab-pane" id="client-activities" style="display:none;">\n{s_prenot}{p_prenot_bar}{s_pal_corsi}{p_pal_well}{s_pal_well}{p_well_subs}                </div>\n'

html = pre_client + client_nav + client_dashboard_html + client_activities_html + post_client

with open("static/index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("UI successfully rebuilt and fixed.")
