import re

with open("static/index.html", "r", encoding="utf-8") as f:
    html = f.read()

# Remove the shop button
html = html.replace('<button class="client-subtab admin-subtab" onclick="switchClientTab(\'shop\')"><i class="fa-solid fa-cart-shopping"></i> Acquisti & Abbonamenti</button>', '')

# Rename dashboard button
html = html.replace('<button class="client-subtab admin-subtab active" onclick="switchClientTab(\'dashboard\')"><i class="fa-solid fa-house-user"></i> Riepilogo</button>', '<button class="client-subtab admin-subtab active" onclick="switchClientTab(\'dashboard\')"><i class="fa-solid fa-house-user"></i> Riepilogo & Acquisti</button>')

# Find client-shop content
s_shop = '                <div class="client-subtab-pane" id="client-shop" style="display:none;">\n'
s_end_shop = '                </div>\n            <!-- TAB 2: VISTA ADMIN -->'

shop_split = html.split(s_shop)
if len(shop_split) > 1:
    pre_shop = shop_split[0]
    shop_content_and_after = shop_split[1]
    
    shop_content = shop_content_and_after.split(s_end_shop)[0]
    post_shop = s_end_shop + shop_content_and_after.split(s_end_shop)[1]
    
    # We remove shop from the bottom
    html_without_shop = pre_shop + post_shop
    
    # Insert shop_content at the end of client-dashboard
    s_end_dashboard = '                </div>\n                <div class="client-subtab-pane" id="client-activities" style="display:none;">'
    html_new = html_without_shop.replace(s_end_dashboard, shop_content + s_end_dashboard)
    
    with open("static/index.html", "w", encoding="utf-8") as f:
        f.write(html_new)
    print("Merged successfully.")
else:
    print("Could not find client-shop.")
