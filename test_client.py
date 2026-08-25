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

def test_client():
    print("Testing 2. Vista Cliente (Riepilogo & Acquisti)")
    
    # Get the member ID
    status, res = make_request(f"{BASE_URL}/api/auth/login", {
        "email": "test@example.com",
        "password": "password123"
    })
    
    member_id = res['id']
    print(f"  -> Member ID: {member_id}")
    
    # 1. Recharge wallet
    print("  -> Recharging wallet...")
    status, res = make_request(f"{BASE_URL}/api/members/{member_id}/recharge", {"amount": 100.0})
    if status == 200 and res.get('balance', 0) >= 100.0:
        print("     [OK] Wallet recharge successful")
    else:
        print("     [FAIL] Wallet recharge:", status, res)
        
    # 2. Get available subscriptions
    print("  -> Getting available subscriptions...")
    status, subs = make_request(f"{BASE_URL}/api/subscriptions/types")
    if status == 200 and len(subs) > 0:
        sub_type_id = subs[0]['id']
        
        # Subscribe
        print(f"  -> Subscribing to type {sub_type_id}...")
        status, sub_res = make_request(f"{BASE_URL}/api/members/{member_id}/subscribe", {
            "member_id": member_id,
            "subscription_type_id": sub_type_id,
            "start_date": str(date.today())
        })
        if status == 200:
            print("     [OK] Subscription purchase successful")
        else:
            print("     [FAIL] Subscription purchase:", status, sub_res)
            
    # 3. Get Smart Bar Products
    print("  -> Getting products...")
    status, products = make_request(f"{BASE_URL}/api/products")
    if status == 200 and len(products) > 0:
        product_id = products[0]['id']
        
        # Purchase product
        print(f"  -> Purchasing product {product_id}...")
        status, purchase_res = make_request(f"{BASE_URL}/api/purchases", {
            "member_id": member_id,
            "product_id": product_id,
            "quantity": 1
        })
        if status == 200:
            print("     [OK] Product purchase successful")
        else:
            print("     [FAIL] Product purchase:", status, purchase_res)

if __name__ == "__main__":
    test_client()
