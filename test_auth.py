import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def make_request(url, payload=None):
    if payload:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    else:
        req = urllib.request.Request(url)
    
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
    except Exception as e:
        return 500, str(e)

def test_auth():
    print("Testing 1. Autenticazione e Gestione Sessioni")
    
    status, res = make_request(f"{BASE_URL}/api/auth/register", {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "password": "password123",
        "phone_number": "1234567890",
        "birth_date": "1990-01-01"
    })
    
    if status == 200 or status == 400:
        if status == 400 and "registrata" in str(res):
            print("     [OK] User already exists (handling gracefully)")
        else:
            print("     [OK] Registration successful")
    else:
        print("     [FAIL] Registration:", status, res)
        
    status, res = make_request(f"{BASE_URL}/api/auth/login", {
        "email": "test@example.com",
        "password": "password123"
    })
    
    if status == 200:
        print("     [OK] Client login successful")
    else:
        print("     [FAIL] Client login:", status, res)
        
    status, res = make_request(f"{BASE_URL}/api/auth/admin/login", {
        "username": "admin",
        "password": "admin"
    })
    
    if status == 200:
        print("     [OK] Admin login successful")
    else:
        print("     [FAIL] Admin login:", status, res)

if __name__ == "__main__":
    test_auth()
