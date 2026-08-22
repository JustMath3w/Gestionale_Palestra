import re

with open("static/index.html", "r", encoding="utf-8") as f:
    html = f.read()

s_cards = "                <!-- CARTE DI RIEPILOGO CLIENTE -->"
s_pal_corsi = "                <!-- PALINSESTO CORSI E DISPONIBILITA POSTI (RF11 & RF12) -->"
s_pal_well = "                <!-- PALINSESTO SERVIZI BENESSERE (RF28) -->"
s_subs = "                <!-- SEZIONE ABBONAMENTI DISPONIBILI -->"
s_prenot = "                <!-- PRENOTAZIONE CORSI E SERVIZI -->"
s_bar = "                <!-- SMART BAR -->"
s_end = "            <!-- TAB 2: VISTA ADMIN -->"

# Extracting parts
pre_client = html.split(s_cards)[0]
p_cards_pal = html.split(s_cards)[1].split(s_pal_corsi)[0]
p_pal_well = html.split(s_pal_corsi)[1].split(s_pal_well)[0]
p_well_subs = html.split(s_pal_well)[1].split(s_subs)[0]
p_subs_prenot = html.split(s_subs)[1].split(s_prenot)[0]
p_prenot_bar = html.split(s_prenot)[1].split(s_bar)[0]
p_bar_end = html.split(s_bar)[1].split(s_end)[0]
post_client = s_end + html.split(s_end)[1]

nav_html = """
                <!-- Client Sub-tabs Navigation -->
                <div class="client-subtabs-nav admin-subtabs-nav">
                    <button class="client-subtab admin-subtab active" onclick="switchClientTab('dashboard')"><i class="fa-solid fa-house-user"></i> Riepilogo</button>
                    <button class="client-subtab admin-subtab" onclick="switchClientTab('activities')"><i class="fa-solid fa-calendar-check"></i> Corsi & Prenotazioni</button>
                    <button class="client-subtab admin-subtab" onclick="switchClientTab('shop')"><i class="fa-solid fa-cart-shopping"></i> Acquisti & Abbonamenti</button>
                </div>

"""

dashboard_html = f"""                <div class="client-subtab-pane active" id="client-dashboard">
{s_cards}{p_cards_pal}                </div>
"""

activities_html = f"""                <div class="client-subtab-pane" id="client-activities" style="display:none;">
{s_prenot}{p_prenot_bar}{s_pal_corsi}{p_pal_well}{s_pal_well}{p_well_subs}                </div>
"""

shop_html = f"""                <div class="client-subtab-pane" id="client-shop" style="display:none;">
{s_subs}{p_subs_prenot}{s_bar}{p_bar_end}                </div>
"""

# Reconstruct HTML
new_html = pre_client + nav_html + dashboard_html + activities_html + shop_html + post_client

with open("static/index.html", "w", encoding="utf-8") as f:
    f.write(new_html)

print("Client view restructured successfully.")
