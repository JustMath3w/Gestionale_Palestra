import json
import sqlite3
import os

models_map = {
    "members.json": "members",
    "subscription_types.json": "subscription_types",
    "member_subscriptions.json": "member_subscriptions",
    "wellness_services.json": "wellness_services",
    "courses.json": "courses",
    "bookings.json": "bookings",
    "products.json": "products",
    "purchases.json": "purchases",
    "access_logs.json": "access_logs",
    "staff.json": "staff"
}

conn = sqlite3.connect('gym.db')
cursor = conn.cursor()

print(f"{'Tabella':<25} | {'Record (Sito/JSON)':<20} | {'Record (Database)':<20} | {'Stato':<10}")
print("-" * 85)

for json_file, table_name in models_map.items():
    json_path = os.path.join("data", json_file)
    json_count = 0
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                json_count = len(data)
            except:
                pass
                
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    db_count = cursor.fetchone()[0]
    
    status = "✅ OK" if json_count == db_count else "❌ Errore"
    print(f"{table_name:<25} | {json_count:<20} | {db_count:<20} | {status:<10}")

conn.close()
