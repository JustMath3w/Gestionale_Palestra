import urllib.request
import urllib.error
import json
import datetime

req = urllib.request.Request("http://localhost:8000/api/courses")
with urllib.request.urlopen(req) as response:
    courses = json.loads(response.read())

c = courses[0]

req = urllib.request.Request("http://localhost:8000/api/members")
with urllib.request.urlopen(req) as response:
    members = json.loads(response.read())
m = members[0]

today = datetime.date.today().strftime("%Y-%m-%d")
booking_data = {
    "member_id": m["id"],
    "service_type": f"course:{c['id']}",
    "booking_date": today,
    "time_slot": "10:00 - 11:00"
}
req = urllib.request.Request("http://localhost:8000/api/bookings", data=json.dumps(booking_data).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        print("Booking created:", json.loads(response.read()))
except urllib.error.HTTPError as e:
    print("Failed to create booking:", e.read().decode())

req = urllib.request.Request("http://localhost:8000/api/admin/stats")
with urllib.request.urlopen(req) as response:
    stats = json.loads(response.read())
print("Courses Popularity:", stats["popularity"]["courses"])
