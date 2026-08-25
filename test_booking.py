import urllib.request
import json
from datetime import date

BASE_URL = "http://127.0.0.1:8000"

def make_request(url, payload=None, method=None):
    if payload:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method=method or 'POST')
    else:
        req = urllib.request.Request(url, method=method or 'GET')
    
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
    except Exception as e:
        return 500, str(e)

def test_booking():
    print("Testing 3. Vista Cliente (Corsi & Prenotazioni)")
    
    # Get the member ID
    status, res = make_request(f"{BASE_URL}/api/auth/login", {
        "email": "test@example.com",
        "password": "password123"
    })
    member_id = res['id']
    
    # 1. Create a course to book
    print("  -> Creating a course (Admin)...")
    status, course = make_request(f"{BASE_URL}/api/courses", {
        "name": "Test Course",
        "description": "Desc",
        "instructor_id": "i1",
        "schedule": "Lun 10:00",
        "max_capacity": 10,
        "trainer": "Test Trainer",
        "allowed_subscriptions": ["basic", "premium"]
    })
    
    if status != 200:
        print("     [FAIL] Failed to create course:", status, course)
        return
        
    course_id = course['id']
    
    # 2. Book the course
    print("  -> Booking the course...")
    status, booking = make_request(f"{BASE_URL}/api/bookings", {
        "member_id": member_id,
        "service_type": f"course:{course_id}",
        "booking_date": str(date.today()),
        "time_slot": "10:00 - 11:00"
    })
    
    if status == 200:
        print("     [OK] Course booked successfully")
    else:
        print("     [FAIL] Booking failed:", status, booking)
        
    # 3. Check cascading delete
    print("  -> Deleting the course (Admin)...")
    status, del_res = make_request(f"{BASE_URL}/api/courses/{course_id}", method='DELETE')
    if status == 200:
        print("     [OK] Course deleted")
    else:
        print("     [FAIL] Course deletion:", status, del_res)
        
    print("  -> Verifying booking is deleted...")
    status, member_bookings = make_request(f"{BASE_URL}/api/members/{member_id}/bookings")
    if any(b['service_type'] == f"course:{course_id}" for b in member_bookings):
        print("     [FAIL] Booking still exists!")
    else:
        print("     [OK] Booking was successfully cascaded-deleted")

if __name__ == "__main__":
    test_booking()
