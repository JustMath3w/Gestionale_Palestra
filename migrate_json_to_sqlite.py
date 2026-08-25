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

# Pass 1: Upsert all data
json_ids_per_model = {}
for filename, ModelClass in models_map.items():
    print(f"Migrating {filename}...")
    data_list = load_json(filename)
    json_ids = set()
    for data in data_list:
        obj = ModelClass.from_dict(data)
        db.merge(obj)
        json_ids.add(str(obj.id))
    json_ids_per_model[ModelClass] = json_ids

# Pass 2: Delete missing records (in reverse order to respect foreign keys)
for filename, ModelClass in reversed(list(models_map.items())):
    db_items = db.query(ModelClass).all()
    json_ids = json_ids_per_model[ModelClass]
    for db_item in db_items:
        if str(db_item.id) not in json_ids:
            print(f"Deleting {db_item.id} from {ModelClass.__tablename__}")
            db.delete(db_item)

db.commit()
db.close()
print("Migration completed successfully!")
