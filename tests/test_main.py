import os
import shutil
import pytest
from fastapi.testclient import TestClient

# Impostiamo l'ambiente per usare i file JSON in una cartella temporanea di test
os.environ["REPOSITORY_TYPE"] = "JSON"
import config
config.JSON_DATA_DIR = "./data_test"

from main import app, get_uow
from repositories import GymUnitOfWork

client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    # Setup: pulizia cartella dati test
    if os.path.exists(config.JSON_DATA_DIR):
        shutil.rmtree(config.JSON_DATA_DIR)
    os.makedirs(config.JSON_DATA_DIR)
    
    yield
    
    # Teardown: pulizia finale
    if os.path.exists(config.JSON_DATA_DIR):
        shutil.rmtree(config.JSON_DATA_DIR)


def test_register_and_login():
    # 1. Registrazione nuovo membro
    reg_payload = {
        "first_name": "Mario",
        "last_name": "Rossi",
        "email": "mario.rossi@example.com",
        "password": "secretpassword",
        "phone": "3331234567",
        "fiscal_code": "RSSMRA80A01F205X"
    }
    response = client.post("/api/auth/register", json=reg_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["first_name"] == "Mario"
    assert data["email"] == "mario.rossi@example.com"
    assert data["balance"] == 0.0
    assert data["is_active"] is True
    assert "id" in data
    
    # Salva l'ID per i test successivi
    member_id = data["id"]

    # Tentativo di registrare di nuovo la stessa email (deve fallire)
    fail_response = client.post("/api/auth/register", json=reg_payload)
    assert fail_response.status_code == 400

    # 2. Login con credenziali corrette
    login_payload = {
        "email": "mario.rossi@example.com",
        "password": "secretpassword"
    }
    login_response = client.post("/api/auth/login", json=login_payload)
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert login_data["id"] == member_id

    # Login con password errata (deve fallire)
    wrong_login_payload = {
        "email": "mario.rossi@example.com",
        "password": "wrongpassword"
    }
    wrong_response = client.post("/api/auth/login", json=wrong_login_payload)
    assert wrong_response.status_code == 401


def test_recharge_wallet():
    # Registra
    reg_payload = {
        "first_name": "Anna",
        "last_name": "Verdi",
        "email": "anna.verdi@example.com",
        "password": "password123"
    }
    reg_data = client.post("/api/auth/register", json=reg_payload).json()
    member_id = reg_data["id"]

    # Esegui ricarica portafoglio
    recharge_payload = {"amount": 50.0}
    response = client.post(f"/api/members/{member_id}/recharge", json=recharge_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["balance"] == 50.0


def test_purchase_subscription_and_check_in():
    # Registra
    reg_data = client.post("/api/auth/register", json={
        "first_name": "Luca",
        "last_name": "Neri",
        "email": "luca.neri@example.com",
        "password": "password123"
    }).json()
    member_id = reg_data["id"]

    # 1. Tentativo di check-in senza abbonamento (deve fallire)
    check_in_resp = client.post("/api/check-in", json={"member_id_or_email": member_id})
    assert check_in_resp.status_code == 200
    assert check_in_resp.json()["is_allowed"] is False
    assert "Nessun abbonamento" in check_in_resp.json()["reason"]

    # 2. Ricarica portafoglio
    client.post(f"/api/members/{member_id}/recharge", json={"amount": 100.0})

    # 3. Acquista abbonamento basic (39.99 €)
    sub_payload = {
        "member_id": member_id,
        "subscription_type_id": "basic",
        "start_date": "2026-07-23"
    }
    sub_resp = client.post(f"/api/members/{member_id}/subscribe", json=sub_payload)
    assert sub_resp.status_code == 200
    sub_data = sub_resp.json()
    assert sub_data["subscription_type_id"] == "basic"
    assert sub_data["is_active"] is True

    # Verifica credito residuo (100 - 39.99 = 60.01)
    member_data = client.get(f"/api/members/{member_id}").json()
    assert round(member_data["balance"], 2) == 60.01

    # 4. Tentativo di check-in con abbonamento attivo (deve riuscire)
    check_in_resp_2 = client.post("/api/check-in", json={"member_id_or_email": member_id})
    assert check_in_resp_2.status_code == 200
    assert check_in_resp_2.json()["is_allowed"] is True

    # 5. Tentativo di acquistare un secondo abbonamento (deve fallire)
    second_sub_payload = {
        "member_id": member_id,
        "subscription_type_id": "premium",
        "start_date": "2026-07-23"
    }
    second_sub_resp = client.post(f"/api/members/{member_id}/subscribe", json=second_sub_payload)
    assert second_sub_resp.status_code == 400
    assert "già un abbonamento attivo" in second_sub_resp.json()["detail"]

    # 6. Disdetta dell'abbonamento attivo
    cancel_resp = client.post(f"/api/members/{member_id}/subscriptions/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "success"

    # 7. Tentativo di check-in dopo la disdetta (deve fallire di nuovo)
    check_in_resp_3 = client.post("/api/check-in", json={"member_id_or_email": member_id})
    assert check_in_resp_3.status_code == 200
    assert check_in_resp_3.json()["is_allowed"] is False


def test_update_member_and_past_booking():
    # Registra
    reg_data = client.post("/api/auth/register", json={
        "first_name": "Paolo",
        "last_name": "Neri",
        "email": "paolo.neri@example.com",
        "password": "password123"
    }).json()
    member_id = reg_data["id"]

    # 1. Aggiorna profilo
    update_payload = {
        "first_name": "Paolo Antonio",
        "last_name": "Neri Rossi",
        "email": "paolo.neri@example.com",
        "phone": "3209876543",
        "fiscal_code": "NRIPLA80A01F205X"
    }
    update_resp = client.put(f"/api/members/{member_id}", json=update_payload)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["first_name"] == "Paolo Antonio"
    assert updated_data["phone"] == "3209876543"

    # 2. Ricarica e attiva abbonamento per poter fare prenotazioni
    client.post(f"/api/members/{member_id}/recharge", json={"amount": 100.0})
    client.post(f"/api/members/{member_id}/subscribe", json={
        "member_id": member_id,
        "subscription_type_id": "vip",
        "start_date": "2026-07-23"
    })

    # 3. Tentativo di prenotazione in una data passata (deve fallire)
    past_booking_payload = {
        "member_id": member_id,
        "service_type": "sauna",
        "booking_date": "2025-01-01",
        "time_slot": "10:00 - 11:00"
    }
    past_resp = client.post("/api/bookings", json=past_booking_payload)
    assert past_resp.status_code == 400
    assert "data passata" in past_resp.json()["detail"]




def test_course_management_and_availability():
    # 1. Admin crea nuovo corso con multiple fasce orarie per giorno
    course_payload = {
        "name": "Crossfit Extreme",
        "trainer": "Giovanni Rossi",
        "weekly_schedule": {
            "Tue": ["09:00 - 10:00", "19:30 - 20:30"],
            "Thu": ["19:30 - 20:30"]
        },
        "max_capacity": 2,
        "allowed_subscriptions": ["premium", "vip"]
    }
    create_resp = client.post("/api/courses", json=course_payload)
    assert create_resp.status_code == 200
    course_data = create_resp.json()
    course_id = course_data["id"]

    # 2026-09-01 is a Tuesday (Tue)
    avail_tue = client.get("/api/courses?date=2026-09-01").json()
    crossfit_tue = next(c for c in avail_tue if c["id"] == course_id)
    assert crossfit_tue["slot_availabilities"]["09:00 - 10:00"]["available_seats"] == 2
    assert crossfit_tue["slot_availabilities"]["19:30 - 20:30"]["available_seats"] == 2

    # 2026-09-02 is a Wednesday (Wed) -> Non in programma, deve restituire 0 posti
    avail_wed = client.get("/api/courses?date=2026-09-02").json()
    crossfit_wed = next(c for c in avail_wed if c["id"] == course_id)
    assert crossfit_wed["available_seats"] == 0


def test_wellness_services_management_and_booking():
    # 1. Admin crea nuovo servizio benessere (es. Solarium Facial)
    wellness_payload = {
        "name": "Solarium Facial",
        "price": 12.0,
        "max_capacity": 1,
        "free_for_subscriptions": ["vip"],
        "weekly_schedule": {
            "Mon": ["10:00 - 11:00", "15:00 - 16:00"]
        }
    }
    create_resp = client.post("/api/wellness-services", json=wellness_payload)
    assert create_resp.status_code == 200
    wellness_data = create_resp.json()
    service_id = wellness_data["id"]

    # 2. Verifica disponibilita per un Lunedi (2026-08-17)
    avail_mon = client.get("/api/wellness-services?date=2026-08-17").json()
    solarium_mon = next(s for s in avail_mon if s["id"] == service_id)
    assert solarium_mon["slot_availabilities"]["10:00 - 11:00"]["available_seats"] == 1

    # 3. Registrazione nuovo membro con abbonamento basic e ricarica
    reg_data = client.post("/api/auth/register", json={
        "first_name": "Elena",
        "last_name": "Verdi",
        "email": "elena.wellness@example.com",
        "password": "password123"
    }).json()
    member_id = reg_data["id"]
    client.post(f"/api/members/{member_id}/recharge", json={"amount": 60.0})
    client.post(f"/api/members/{member_id}/subscribe", json={
        "member_id": member_id,
        "subscription_type_id": "basic",
        "start_date": "2026-08-01"
    })

    # 4. Prenotazione del Solarium
    book_resp = client.post("/api/bookings", json={
        "member_id": member_id,
        "service_type": f"wellness:{service_id}",
        "booking_date": "2026-08-17",
        "time_slot": "10:00 - 11:00"
    })
    assert book_resp.status_code == 200

    # 5. Verifica che il saldo sia sceso a 8.01€ (60 - 39.99 - 12)
    member_data = client.get(f"/api/members/{member_id}").json()
    assert round(member_data["balance"], 2) == 8.01

    # 6. Verifica che lo slot sia ora esaurito (capienza max 1)
    avail_after = client.get("/api/wellness-services?date=2026-08-17").json()
    solarium_after = next(s for s in avail_after if s["id"] == service_id)
    assert solarium_after["slot_availabilities"]["10:00 - 11:00"]["available_seats"] == 0
