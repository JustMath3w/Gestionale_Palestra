import urllib.request
import urllib.error
import json
import datetime

# 1. Get courses
req = urllib.request.Request("http://localhost:8000/api/courses")
with urllib.request.urlopen(req) as response:
    courses = json.loads(response.read())
c = courses[0] # Corso Spinning

# 2. Get members
req = urllib.request.Request("http://localhost:8000/api/members")
with urllib.request.urlopen(req) as response:
    members = json.loads(response.read())
m = members[0]

# find next Monday
today = datetime.date.today()
next_monday = today + datetime.timedelta(days=(0 - today.weekday()) % 7)
if next_monday == today:
    next_monday += datetime.timedelta(days=7)

booking_data = {
    "member_id": m["id"],
    "service_type": f"course:{c['id']}",
    "booking_date": next_monday.strftime("%Y-%m-%d"),
    "time_slot": "10:00 - 11:00"
}
req = urllib.request.Request("http://localhost:8000/api/bookings", data=json.dumps(booking_data).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        print("Booking created:", json.loads(response.read()))
except urllib.error.HTTPError as e:
    print("Failed to create booking:", e.read().decode())

# 4. Get stats
req = urllib.request.Request("http://localhost:8000/api/admin/stats")
with urllib.request.urlopen(req) as response:
    stats = json.loads(response.read())
print("Courses Popularity:", stats["popularity"]["courses"])
