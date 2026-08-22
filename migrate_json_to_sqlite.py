import os
import json
from database import engine, SessionLocal
from models import Base, Member, SubscriptionType, MemberSubscription, WellnessService, Course, Booking, Product, Purchase, AccessLog, Staff

def load_json(filename):
    path = os.path.join("data", filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

print("Initializing DB...")
Base.metadata.create_all(bind=engine)
db = SessionLocal()

models_map = {
    "members.json": Member,
    "subscription_types.json": SubscriptionType,
    "member_subscriptions.json": MemberSubscription,
    "wellness_services.json": WellnessService,
    "courses.json": Course,
    "bookings.json": Booking,
    "products.json": Product,
    "purchases.json": Purchase,
    "access_logs.json": AccessLog,
    "staff.json": Staff
}

for filename, ModelClass in models_map.items():
    print(f"Migrating {filename}...")
    data_list = load_json(filename)
    for data in data_list:
        obj = ModelClass.from_dict(data)
        db.merge(obj)

db.commit()
db.close()
print("Migration completed successfully!")
