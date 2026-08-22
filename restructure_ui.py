import re

with open("static/index.html", "r", encoding="utf-8") as f:
    html = f.read()

s_fin = "                    <!-- REPORT FINANZIARI GENERALI -->"
s_staff = "                    <!-- GESTIONE STAFF (RF27) -->"
s_users = "                    <!-- GESTIONE UTENTI -->"
s_subs = "                    <!-- GESTIONE ABBONAMENTI (RF6) -->"
s_courses = "                    <!-- GESTIONE CORSI (RF10) -->"
s_history = "                    <!-- STORICO SOTTOSCRIZIONI -->"
s_products = "                    <!-- GESTIONE CATALOGO PRODOTTI (RF18) -->"
s_wellness = "                    <!-- GESTIONE SERVIZI BENESSERE (RF28) -->"
s_end = "                </div>\n            </section>\n\n            <!-- TAB 3: TORNELLO DI INGRESSO -->"

pre_admin = html.split(s_fin)[0]
p_fin_staff = html.split(s_fin)[1].split(s_staff)[0]
p_staff_users = html.split(s_staff)[1].split(s_users)[0]
p_users_subs = html.split(s_users)[1].split(s_subs)[0]
p_subs_courses = html.split(s_subs)[1].split(s_courses)[0]
p_courses_hist = html.split(s_courses)[1].split(s_history)[0]
p_hist_prod = html.split(s_history)[1].split(s_products)[0]
p_prod_well = html.split(s_products)[1].split(s_wellness)[0]
p_well_end = html.split(s_wellness)[1].split(s_end)[0]
post_admin = s_end + html.split(s_end)[1]

nav_html = """
                    <!-- Admin Sub-tabs Navigation -->
                    <div class="admin-subtabs-nav">
                        <button class="admin-subtab active" onclick="switchAdminTab('dashboard')"><i class="fa-solid fa-chart-pie"></i> Dashboard</button>
                        <button class="admin-subtab" onclick="switchAdminTab('users')"><i class="fa-solid fa-users"></i> Utenti & Staff</button>
                        <button class="admin-subtab" onclick="switchAdminTab('activities')"><i class="fa-solid fa-dumbbell"></i> Attività</button>
                        <button class="admin-subtab" onclick="switchAdminTab('shop')"><i class="fa-solid fa-store"></i> Negozio & Abbonamenti</button>
                    </div>

"""

dashboard_html = f"""                    <div class="admin-subtab-pane active" id="admin-dashboard">
{s_fin}{p_fin_staff}                    </div>
"""

users_html = f"""                    <div class="admin-subtab-pane" id="admin-users" style="display:none;">
{s_users}{p_users_subs}{s_staff}{p_staff_users}                    </div>
"""

activities_html = f"""                    <div class="admin-subtab-pane" id="admin-activities" style="display:none;">
{s_courses}{p_courses_hist}{s_wellness}{p_well_end}                    </div>
"""

shop_html = f"""                    <div class="admin-subtab-pane" id="admin-shop" style="display:none;">
{s_subs}{p_subs_courses}{s_products}{p_prod_well}{s_history}{p_hist_prod}                    </div>
"""

new_html = pre_admin + nav_html + dashboard_html + users_html + activities_html + shop_html + post_admin

with open("static/index.html", "w", encoding="utf-8") as f:
    f.write(new_html)

print("Restructured successfully.")
