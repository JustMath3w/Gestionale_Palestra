import os
import hashlib
from datetime import datetime, date, timedelta

from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional

import config
import schemas
import models
from database import SessionLocal, init_db
from repositories import GymUnitOfWork

app = FastAPI(
    title="Gestionale_Gym API",
    description="Backend per il progetto universitario del Gestionale Palestra",
    version="1.0.0"
)

# Configurazione CORS per sviluppo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inizializza il DB SQLite se attivo
init_db()

# --- Helper di Hashing delle Password ---
def hash_password(password: str) -> str:
    # Nota per l'esame: per motivi didattici e di portabilità usiamo SHA256. 
    # In produzione si utilizzerebbe bcrypt con salt.
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


# --- Dependency Injection per la persistenza (Unit of Work) ---
def get_uow():
    if config.REPOSITORY_TYPE == "SQLITE":
        db = SessionLocal()
        try:
            yield GymUnitOfWork(db)
        finally:
            db.close()
    else:
        yield GymUnitOfWork()


# =====================================================================
# API: AUTENTICAZIONE E UTENTI
# =====================================================================

@app.post("/api/auth/register", response_model=schemas.MemberResponse, tags=["Autenticazione"])
def register_member(member_data: schemas.MemberCreate, uow: GymUnitOfWork = Depends(get_uow)):
    # Controlla se l'email esiste già
    existing = uow.members.get_by_email(member_data.email)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Un membro con questo indirizzo email è già registrato."
        )
    
    # Crea il nuovo membro
    new_member = models.Member(
        first_name=member_data.first_name,
        last_name=member_data.last_name,
        email=member_data.email,
        password_hash=hash_password(member_data.password),
        phone=member_data.phone,
        fiscal_code=member_data.fiscal_code,
        balance=0.0,
        is_active=True
    )
    saved = uow.members.save(new_member)
    return saved


@app.post("/api/auth/login", response_model=schemas.MemberResponse, tags=["Autenticazione"])
def login_member(login_data: Dict[str, str], uow: GymUnitOfWork = Depends(get_uow)):
    email = login_data.get("email")
    password = login_data.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email e password sono richieste.")
        
    member = uow.members.get_by_email(email)
    if not member or member.password_hash != hash_password(password):
        raise HTTPException(status_code=401, detail="Credenziali non valide.")
        
    if not member.is_active:
        raise HTTPException(status_code=403, detail="Questo account è stato disattivato.")
        
    return member


@app.post("/api/auth/admin/login", tags=["Autenticazione"])
def login_admin(login_data: Dict[str, str], uow: GymUnitOfWork = Depends(get_uow)):
    username = login_data.get("username")
    password = login_data.get("password")
    
    staff_member = uow.staff.get_by_username(username)
    if staff_member and staff_member.password_hash == password:
        return {"status": "success", "username": staff_member.username, "role": staff_member.role}
        
    raise HTTPException(status_code=401, detail="Credenziali amministratore non valide.")

# --- Gestione Staff (RF27) ---
@app.get("/api/admin/staff", response_model=List[schemas.StaffResponse], tags=["Staff (Admin)"])
def get_staff_list(uow: GymUnitOfWork = Depends(get_uow)):
    return uow.staff.get_all()

@app.post("/api/admin/staff", response_model=schemas.StaffResponse, tags=["Staff (Admin)"])
def create_staff(staff_data: schemas.StaffCreate, uow: GymUnitOfWork = Depends(get_uow)):
    if uow.staff.get_by_username(staff_data.username):
        raise HTTPException(status_code=400, detail="Username già in uso.")
        
    from models import Staff
    new_staff = Staff(
        username=staff_data.username,
        password_hash=staff_data.password,
        role=staff_data.role
    )
    return uow.staff.save(new_staff)

@app.delete("/api/admin/staff/{staff_id}", tags=["Staff (Admin)"])
def delete_staff(staff_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    if uow.staff.delete(staff_id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Membro dello staff non trovato.")


@app.get("/api/members/{member_id}", response_model=schemas.MemberResponse, tags=["Membri"])
def get_member(member_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    member = uow.members.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato.")
    return member


@app.get("/api/members", response_model=List[schemas.MemberResponse], tags=["Membri (Admin)"])
def get_all_members(uow: GymUnitOfWork = Depends(get_uow)):
    return uow.members.get_all()


@app.post("/api/members/{member_id}/recharge", response_model=schemas.MemberResponse, tags=["Membri"])
def recharge_wallet(member_id: str, recharge: schemas.RicaricaRequest, uow: GymUnitOfWork = Depends(get_uow)):
    member = uow.members.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato.")
    if recharge.amount <= 0:
        raise HTTPException(status_code=400, detail="L'importo di ricarica deve essere positivo.")
        
    member.balance += recharge.amount
    uow.members.save(member)
    return member


@app.put("/api/members/{member_id}", response_model=schemas.MemberResponse, tags=["Membri"])
def update_member(member_id: str, member_data: schemas.MemberUpdate, uow: GymUnitOfWork = Depends(get_uow)):
    member = uow.members.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato.")
    
    if member_data.first_name is not None: member.first_name = member_data.first_name
    if member_data.last_name is not None: member.last_name = member_data.last_name
    if member_data.email is not None:
        existing = uow.members.get_by_email(member_data.email)
        if existing and existing.id != member_id:
            raise HTTPException(status_code=400, detail="Questo indirizzo email è già associato a un altro membro.")
        member.email = member_data.email
    if member_data.phone is not None: member.phone = member_data.phone
    if member_data.fiscal_code is not None: member.fiscal_code = member_data.fiscal_code
    if member_data.is_active is not None: member.is_active = member_data.is_active
    
    saved = uow.members.save(member)
    return saved


@app.post("/api/members/{member_id}/toggle-status", response_model=schemas.MemberResponse, tags=["Membri (Admin)"])
def toggle_member_status(member_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    member = uow.members.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato.")
    member.is_active = not member.is_active
    saved = uow.members.save(member)
    return saved


@app.delete("/api/members/{member_id}", tags=["Membri (Admin)"])
def delete_member(member_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    member = uow.members.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato.")

    uow.members.delete(member_id)
    return {"success": True, "message": "Membro eliminato con successo."}

# =====================================================================
# API: ABBONAMENTI
# =====================================================================

@app.get("/api/subscriptions/types", response_model=List[schemas.SubscriptionTypeResponse], tags=["Abbonamenti"])
def get_subscription_types(uow: GymUnitOfWork = Depends(get_uow)):
    return uow.subscription_types.get_all()


@app.post("/api/members/{member_id}/subscribe", response_model=schemas.MemberSubscriptionResponse, tags=["Abbonamenti"])
def purchase_subscription(member_id: str, sub_req: schemas.MemberSubscriptionCreate, uow: GymUnitOfWork = Depends(get_uow)):
    member = uow.members.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato.")
    if not member.is_active:
        raise HTTPException(status_code=403, detail="Account sospeso. L'operazione non è permessa.")
        
    sub_type = uow.subscription_types.get_by_id(sub_req.subscription_type_id)
    if not sub_type:
        raise HTTPException(status_code=404, detail="Tipo di abbonamento non trovato.")
        
    # Controlla se l'utente ha già un abbonamento attivo
    prev_subs = uow.subscriptions.get_by_member_id(member_id)
    today_str = date.today().strftime("%Y-%m-%d")
    active_subs = [s for s in prev_subs if s.is_active and s.end_date >= today_str]
    if active_subs:
        raise HTTPException(status_code=400, detail="Hai già un abbonamento attivo. Devi prima disdirlo per sottoscriverne uno nuovo.")

    # Controlla se l'utente ha credito sufficiente
    if member.balance < sub_type.price:
        raise HTTPException(status_code=400, detail="Credito insufficiente. Ricarica il portafoglio virtuale.")
        
    # Detrae il saldo
    member.balance -= sub_type.price
    uow.members.save(member)
    
    # Calcola date
    try:
        start_dt = datetime.strptime(sub_req.start_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato data inizio non valido. Usa YYYY-MM-DD.")
        
    end_dt = start_dt + timedelta(days=sub_type.duration_days)
    
    # Disattiva eventuali abbonamenti attivi precedenti per pulizia
    for ps in prev_subs:
        if ps.is_active:
            ps.is_active = False
            uow.subscriptions.save(ps)

    # Crea l'abbonamento
    new_sub = models.MemberSubscription(
        member_id=member_id,
        subscription_type_id=sub_type.id,
        start_date=sub_req.start_date,
        end_date=end_dt.strftime("%Y-%m-%d"),
        is_active=True
    )
    
    saved_sub = uow.subscriptions.save(new_sub)
    return saved_sub


@app.post("/api/members/{member_id}/subscriptions/cancel", tags=["Abbonamenti"])
def cancel_member_subscription(member_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    member = uow.members.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato.")
        
    prev_subs = uow.subscriptions.get_by_member_id(member_id)
    today_str = date.today().strftime("%Y-%m-%d")
    active_subs = [s for s in prev_subs if s.is_active and s.end_date >= today_str]
    
    if not active_subs:
        raise HTTPException(status_code=400, detail="Nessun abbonamento attivo trovato da disdire.")
        
    active_sub = active_subs[0]
    active_sub.is_active = False
    uow.subscriptions.save(active_sub)
    return {"status": "success", "message": "Abbonamento disdetto con successo."}



@app.get("/api/members/{member_id}/subscriptions", response_model=List[schemas.MemberSubscriptionResponse], tags=["Abbonamenti"])
def get_member_subscriptions(member_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    return uow.subscriptions.get_by_member_id(member_id)


# =====================================================================
# API: PRENOTAZIONE CORSI E SERVIZI SPECIALI
# =====================================================================

@app.get("/api/courses", response_model=List[schemas.CourseResponse], tags=["Corsi"])
def get_courses(date: Optional[str] = Query(None), uow: GymUnitOfWork = Depends(get_uow)):
    courses = uow.courses.get_all()
    all_bookings = uow.bookings.get_all() if date else []
    
    DAYS_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
    target_day_code = None
    if date:
        try:
            target_date_obj = datetime.strptime(date, "%Y-%m-%d").date()
            target_day_code = DAYS_MAP[target_date_obj.weekday()]
        except ValueError:
            pass

    result = []
    for c in courses:
        c_dict = c.to_dict()
        ws = c.weekly_schedule or {}
        
        if date and target_day_code:
            day_slots = ws.get(target_day_code, [])
            if not day_slots:
                c_dict["booked_count"] = 0
                c_dict["available_seats"] = 0
                c_dict["slot_availabilities"] = {}
            else:
                target_service = f"course:{c.id}"
                slot_avail = {}
                total_avail = 0
                total_booked = 0
                for slot in day_slots:
                    booked = sum(1 for b in all_bookings if b.service_type == target_service and b.booking_date == date and b.time_slot == slot)
                    avail = max(0, c.max_capacity - booked)
                    slot_avail[slot] = {
                        "booked_count": booked,
                        "available_seats": avail,
                        "max_capacity": c.max_capacity
                    }
                    total_avail += avail
                    total_booked += booked
                c_dict["booked_count"] = total_booked
                c_dict["available_seats"] = total_avail
                c_dict["slot_availabilities"] = slot_avail
        else:
            c_dict["booked_count"] = 0
            c_dict["available_seats"] = c.max_capacity
            c_dict["slot_availabilities"] = {}
        result.append(c_dict)
    return result


@app.post("/api/bookings", response_model=schemas.BookingResponse, tags=["Prenotazioni"])
def book_service(booking_data: schemas.BookingCreate, uow: GymUnitOfWork = Depends(get_uow)):
    # Controllo che la prenotazione non sia nel passato
    today_str = date.today().strftime("%Y-%m-%d")
    if booking_data.booking_date < today_str:
        raise HTTPException(status_code=400, detail="Non puoi prenotare in una data passata.")
        
    if booking_data.booking_date == today_str:
        try:
            slot_start_str = booking_data.time_slot.split("-")[0].strip()
            slot_time = datetime.strptime(slot_start_str, "%H:%M").time()
            current_time = datetime.now().time()
            if slot_time < current_time:
                raise HTTPException(status_code=400, detail="Questo slot orario è già passato per la giornata di oggi.")
        except Exception:
            pass

    member = uow.members.get_by_id(booking_data.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato.")
    if not member.is_active:
        raise HTTPException(status_code=403, detail="Account sospeso. L'operazione non è permessa.")
        
    # Verifica validità abbonamento dell'utente
    active_subs = [s for s in uow.subscriptions.get_by_member_id(booking_data.member_id) if s.is_active]
    if not active_subs:
        raise HTTPException(status_code=400, detail="Nessun abbonamento attivo trovato. Devi prima abbonarti.")
    
    active_sub = active_subs[0]
    sub_type = uow.subscription_types.get_by_id(active_sub.subscription_type_id)
    sub_services = (sub_type.services if sub_type else []) or []
    sub_type_id = sub_type.id if sub_type else active_sub.subscription_type_id
    
    # Costo di prenotazione del servizio (default 0.0 per corsi, ma configurabile per servizi benessere)
    cost = 0.0
    
    # 1. Caso Corso
    if booking_data.service_type.startswith("course:"):
        course_id = booking_data.service_type.split(":")[1]
        course = uow.courses.get_by_id(course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Corso non trovato.")
            
        # Verifica se il tipo di abbonamento consente l'accesso ai corsi
        has_corsi_service = ("corsi" in sub_services) or ("vip" in sub_type_id)
        allowed_subs = course.allowed_subscriptions or []
        
        if allowed_subs:
            is_sub_allowed = (sub_type_id in allowed_subs) or ("vip" in sub_type_id) or has_corsi_service
            if not is_sub_allowed:
                raise HTTPException(status_code=403, detail="Il tuo abbonamento non include l'accesso a questo corso.")
        else:
            if not has_corsi_service:
                raise HTTPException(status_code=403, detail="Il tuo abbonamento non include l'accesso ai corsi.")

        # Verifica se la data prenotata corrisponde ai giorni di svolgimento del corso
        DAYS_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
        DAY_NAMES_IT = {"Mon": "Lunedì", "Tue": "Martedì", "Wed": "Mercoledì", "Thu": "Giovedì", "Fri": "Venerdì", "Sat": "Sabato", "Sun": "Domenica"}

        try:
            booking_date_obj = datetime.strptime(booking_data.booking_date, "%Y-%m-%d").date()
            day_code = DAYS_MAP[booking_date_obj.weekday()]
            ws = course.weekly_schedule
            if ws and day_code not in ws:
                allowed_days_it = ", ".join([DAY_NAMES_IT.get(d, d) for d in ws.keys()])
                raise HTTPException(
                    status_code=400,
                    detail=f"Il corso '{course.name}' non si svolge di {DAY_NAMES_IT.get(day_code, day_code)}. Si svolge nei giorni: {allowed_days_it}."
                )
            
            valid_slots = ws.get(day_code, []) if ws else ([course.time_slot] if course.time_slot else [])
            if valid_slots and booking_data.time_slot not in valid_slots:
                valid_slots_str = ", ".join(valid_slots)
                raise HTTPException(
                    status_code=400,
                    detail=f"L'orario selezionato ({booking_data.time_slot}) non è disponibile per {DAY_NAMES_IT.get(day_code, day_code)}. Orari previsti: {valid_slots_str}."
                )
        except ValueError:
            pass
            
        # Verifica capacità posti
        all_bookings = uow.bookings.get_all()
        course_bookings = [
            b for b in all_bookings 
            if b.service_type == booking_data.service_type 
            and b.booking_date == booking_data.booking_date 
            and b.time_slot == booking_data.time_slot
        ]
        if len(course_bookings) >= course.max_capacity:
            raise HTTPException(status_code=400, detail="Questo corso ha raggiunto la capacità massima per questo slot.")
            
        # Controlla se l'utente è già prenotato
        for cb in course_bookings:
            if cb.member_id == booking_data.member_id:
                raise HTTPException(status_code=400, detail="Sei già iscritto a questo corso per questo giorno/ora.")

    # 2. Caso Servizi Benessere
    else:
        raw_id = booking_data.service_type.replace("wellness:", "")
        wellness_service = uow.wellness_services.get_by_id(raw_id)
        if not wellness_service:
            all_ws = uow.wellness_services.get_all()
            for ws_item in all_ws:
                if ws_item.id == raw_id or ws_item.name.lower() == raw_id.lower():
                    wellness_service = ws_item
                    break

        if not wellness_service:
            raise HTTPException(status_code=404, detail="Servizio benessere non trovato.")

        DAYS_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
        DAY_NAMES_IT = {"Mon": "Lunedì", "Tue": "Martedì", "Wed": "Mercoledì", "Thu": "Giovedì", "Fri": "Venerdì", "Sat": "Sabato", "Sun": "Domenica"}

        try:
            booking_date_obj = datetime.strptime(booking_data.booking_date, "%Y-%m-%d").date()
            day_code = DAYS_MAP[booking_date_obj.weekday()]
            ws_sched = wellness_service.weekly_schedule
            if ws_sched and day_code not in ws_sched:
                allowed_days_it = ", ".join([DAY_NAMES_IT.get(d, d) for d in ws_sched.keys()])
                raise HTTPException(
                    status_code=400,
                    detail=f"Il servizio '{wellness_service.name}' non è disponibile di {DAY_NAMES_IT.get(day_code, day_code)}. Giorni previsti: {allowed_days_it}."
                )

            valid_slots = ws_sched.get(day_code, []) if ws_sched else []
            if valid_slots and booking_data.time_slot not in valid_slots:
                valid_slots_str = ", ".join(valid_slots)
                raise HTTPException(
                    status_code=400,
                    detail=f"L'orario ({booking_data.time_slot}) non è disponibile per {DAY_NAMES_IT.get(day_code, day_code)}. Orari previsti: {valid_slots_str}."
                )
        except ValueError:
            pass

        all_bookings = uow.bookings.get_all()
        slot_bookings = [
            b for b in all_bookings 
            if (b.service_type == booking_data.service_type or b.service_type == f"wellness:{wellness_service.id}" or b.service_type == wellness_service.id)
            and b.booking_date == booking_data.booking_date 
            and b.time_slot == booking_data.time_slot
        ]
        if len(slot_bookings) >= wellness_service.max_capacity:
            raise HTTPException(status_code=400, detail="Servizio esaurito per questo slot orario.")

        for sb in slot_bookings:
            if sb.member_id == booking_data.member_id:
                raise HTTPException(status_code=400, detail="Hai già una prenotazione per questo servizio in questo slot.")

        free_subs = wellness_service.free_for_subscriptions or []
        sub_services = sub_type.services or []
        is_free = (sub_type.id in free_subs) or ("vip" in sub_type.id) or (wellness_service.id in sub_services) or ("servizi" in sub_services) or ("sauna" in sub_services and wellness_service.id == "sauna") or ("massage_chair" in sub_services and wellness_service.id == "massage_chair")
        
        if not is_free:
            cost = wellness_service.price

        if cost > 0.0:
            if member.balance < cost:
                raise HTTPException(status_code=400, detail=f"Credito insufficiente per prenotare questo servizio (Costo: {cost:.2f}€, Saldo: {member.balance:.2f}€).")
            member.balance -= cost
            uow.members.save(member)
        
    # Registra prenotazione
    new_booking = models.Booking(
        member_id=booking_data.member_id,
        service_type=booking_data.service_type,
        booking_date=booking_data.booking_date,
        time_slot=booking_data.time_slot,
        cost=cost
    )
    saved_booking = uow.bookings.save(new_booking)
    return saved_booking


@app.get("/api/members/{member_id}/bookings", response_model=List[schemas.BookingResponse], tags=["Prenotazioni"])
def get_member_bookings(member_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    return uow.bookings.get_by_member_id(member_id)


@app.delete("/api/bookings/{booking_id}", tags=["Prenotazioni"])
def cancel_booking(booking_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    booking = uow.bookings.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata.")
        
    # Rimborso se c'era un costo addebitato
    if booking.cost > 0.0:
        member = uow.members.get_by_id(booking.member_id)
        if member:
            member.balance += booking.cost
            uow.members.save(member)
            
    success = uow.bookings.delete(booking_id)
    return {"success": success, "message": "Prenotazione cancellata con successo."}


# =====================================================================
# API: SMART BAR (PRODOTTI E ACQUISTI)
# =====================================================================

@app.get("/api/products", response_model=List[schemas.ProductResponse], tags=["Smart Bar"])
def get_products(uow: GymUnitOfWork = Depends(get_uow)):
    return uow.products.get_all()


@app.post("/api/purchases", response_model=schemas.PurchaseResponse, tags=["Smart Bar"])
def buy_product(purchase_req: schemas.PurchaseCreate, uow: GymUnitOfWork = Depends(get_uow)):
    member = uow.members.get_by_id(purchase_req.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Membro non trovato.")
    if not member.is_active:
        raise HTTPException(status_code=403, detail="Account sospeso. L'operazione non è permessa.")
        
    product = uow.products.get_by_id(purchase_req.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato.")
        
    if product.stock <= 0:
        raise HTTPException(status_code=400, detail="Prodotto esaurito.")
        
    member_subs = uow.subscriptions.get_by_member_id(purchase_req.member_id)
    active_subs = [s for s in member_subs if s.is_active]
    final_price = product.price
    if active_subs:
        sub_type = uow.subscription_types.get_by_id(active_subs[0].subscription_type_id)
        if sub_type:
            sub_services = sub_type.services or []
            if "bevande" in sub_services:
                final_price = 0.0

    if member.balance < final_price:
        raise HTTPException(status_code=400, detail="Credito insufficiente. Ricarica il portafoglio virtuale.")
        
    # Esegui transazione
    member.balance -= final_price
    product.stock -= 1
    
    uow.members.save(member)
    uow.products.save(product)
    
    new_purchase = models.Purchase(
        member_id=purchase_req.member_id,
        product_name=product.name,
        price=final_price,
        purchase_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )
    saved = uow.purchases.save(new_purchase)
    return saved


# =====================================================================
# API: CONTROLLO INGRESSI (TORNELLO VIRTUALE)
# =====================================================================

@app.post("/api/check-in", response_model=schemas.CheckInResponse, tags=["Controllo Ingressi"])
def scan_check_in(check_req: schemas.CheckInRequest, uow: GymUnitOfWork = Depends(get_uow)):
    search_term = check_req.member_id_or_email.strip()
    
    # 1. Cerca il membro per ID o per Email
    member = uow.members.get_by_id(search_term)
    if not member:
        member = uow.members.get_by_email(search_term)
        
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Se il membro non esiste
    if not member:
        log = models.AccessLog(
            member_id="Sconosciuto",
            timestamp=timestamp_str,
            is_allowed=False,
            reason="Membro non identificato nel sistema."
        )
        uow.access_logs.save(log)
        return schemas.CheckInResponse(
            is_allowed=False,
            member_name="Sconosciuto",
            reason="ID o Email errati. Membro non trovato.",
            timestamp=timestamp_str
        )
        
    # Se l'account è disattivato
    if not member.is_active:
        log = models.AccessLog(
            member_id=member.id,
            timestamp=timestamp_str,
            is_allowed=False,
            reason="Account utente disattivato."
        )
        uow.access_logs.save(log)
        return schemas.CheckInResponse(
            is_allowed=False,
            member_name=f"{member.first_name} {member.last_name}",
            reason="Accesso negato. Il tuo account è disattivato.",
            timestamp=timestamp_str
        )
        
    # Cerca un abbonamento attivo
    member_subs = uow.subscriptions.get_by_member_id(member.id)
    active_subs = [s for s in member_subs if s.is_active]
    
    # Verifica le date dell'abbonamento attivo
    today_str = date.today().strftime("%Y-%m-%d")
    is_valid = False
    refusal_reason = "Nessun abbonamento attivo registrato."
    
    if active_subs:
        active_sub = active_subs[0]
        # Se la data di fine è passata rispetto ad oggi, consideralo scaduto
        if active_sub.end_date < today_str:
            active_sub.is_active = False
            uow.subscriptions.save(active_sub)
            refusal_reason = f"Abbonamento scaduto il {active_sub.end_date}."
        elif active_sub.start_date > today_str:
            refusal_reason = f"L'abbonamento non è ancora valido. Inizio il {active_sub.start_date}."
        else:
            is_valid = True
            
    # Salva il registro di accesso
    log = models.AccessLog(
        member_id=member.id,
        timestamp=timestamp_str,
        is_allowed=is_valid,
        reason="Accesso convalidato." if is_valid else refusal_reason
    )
    uow.access_logs.save(log)
    
    return schemas.CheckInResponse(
        is_allowed=is_valid,
        member_name=f"{member.first_name} {member.last_name}",
        reason="Benvenuto in palestra! Ingressi tornello sbloccato." if is_valid else f"Accesso negato: {refusal_reason}",
        timestamp=timestamp_str
    )


# =====================================================================
# API: STATISTICHE E AMMINISTRAZIONE (PANNELLO ADMIN)
# =====================================================================

@app.get("/api/admin/subscriptions-history", response_model=List[schemas.AdminSubscriptionHistoryMember], tags=["Abbonamenti (Admin)"])
def get_subscriptions_history(uow: GymUnitOfWork = Depends(get_uow)):
    members = uow.members.get_all()
    history = []
    for m in members:
        subs = uow.subscriptions.get_by_member_id(m.id)
        history.append(schemas.AdminSubscriptionHistoryMember(
            member_id=m.id,
            first_name=m.first_name,
            last_name=m.last_name,
            email=m.email,
            subscriptions=[
                schemas.MemberSubscriptionResponse(
                    id=s.id,
                    member_id=s.member_id,
                    subscription_type_id=s.subscription_type_id,
                    start_date=s.start_date,
                    end_date=s.end_date,
                    is_active=s.is_active
                ) for s in subs
            ]
        ))
    return history

@app.get("/api/admin/logs", response_model=List[schemas.AccessLogResponse], tags=["Statistiche & Log (Admin)"])
def get_access_logs(uow: GymUnitOfWork = Depends(get_uow)):
    # Ritorna gli ultimi log di accesso (ordinati dal più recente)
    logs = uow.access_logs.get_all()
    logs.reverse()
    return logs


@app.get("/api/admin/stats", tags=["Statistiche & Log (Admin)"])
def get_gym_statistics(period_weeks: int = 1, popularity_offset: int = 0, uow: GymUnitOfWork = Depends(get_uow)):
    # 1. Entrate per Categoria
    revenue_subscriptions = 0.0
    revenue_bar = 0.0
    revenue_services = 0.0
    
    # Entrate abbonamenti: sommiamo i prezzi dei tipi di abbonamento venduti
    all_subs = uow.subscriptions.get_all()
    for s in all_subs:
        sub_type = uow.subscription_types.get_by_id(s.subscription_type_id)
        if sub_type:
            revenue_subscriptions += sub_type.price
            
    # Entrate Bar: acquisti registrati
    all_purchases = uow.purchases.get_all()
    for p in all_purchases:
        revenue_bar += p.price
        
    # Entrate Servizi Benessere: costi delle prenotazioni sauna/poltrone massaggianti
    all_bookings = uow.bookings.get_all()
    for b in all_bookings:
        revenue_services += b.cost
        
    # Date range calculation
    from datetime import timedelta, date
    today = date.today()
    current_monday = today - timedelta(days=today.weekday())
    target_start = current_monday - timedelta(weeks=period_weeks - 1)
    target_end = current_monday + timedelta(days=6)
    
    pop_start = current_monday + timedelta(weeks=popularity_offset)
    pop_end = pop_start + timedelta(days=6)
    
    week_range_str = f"{target_start.strftime('%d/%m/%Y')} - {target_end.strftime('%d/%m/%Y')}"
    
    dates_by_filter = {"all": []}
    for i in range(7):
        dates_by_filter[str(i)] = []
        
    curr = target_start
    while curr <= target_end:
        d_str = curr.strftime("%d/%m")
        dates_by_filter["all"].append(d_str)
        dates_by_filter[str(curr.weekday())].append(d_str)
        curr += timedelta(days=1)
        
    # 2. Affluenza oraria media (basata sui log)
    # Creiamo una distribuzione delle frequenze per ora del giorno (0-23)
    affluence_by_day = {
        "all": {str(h).zfill(2) + ":00": 0 for h in range(7, 23)},
        "0": {str(h).zfill(2) + ":00": 0 for h in range(7, 23)},
        "1": {str(h).zfill(2) + ":00": 0 for h in range(7, 23)},
        "2": {str(h).zfill(2) + ":00": 0 for h in range(7, 23)},
        "3": {str(h).zfill(2) + ":00": 0 for h in range(7, 23)},
        "4": {str(h).zfill(2) + ":00": 0 for h in range(7, 23)},
        "5": {str(h).zfill(2) + ":00": 0 for h in range(7, 23)},
        "6": {str(h).zfill(2) + ":00": 0 for h in range(7, 23)}
    }
    
    unique_days = {k: set() for k in affluence_by_day.keys()}
    all_logs = uow.access_logs.get_all()
    
    for log in all_logs:
        if log.is_allowed:
            try:
                log_time = datetime.strptime(log.timestamp, "%Y-%m-%d %H:%M:%S")
                d_date = log_time.date()
                
                if target_start <= d_date <= target_end:
                    d_str = str(d_date.weekday())
                    
                    unique_days["all"].add(d_date)
                    unique_days[d_str].add(d_date)
                    
                    hour_key = str(log_time.hour).zfill(2) + ":00"
                    if hour_key in affluence_by_day["all"]:
                        affluence_by_day["all"][hour_key] += 1
                        affluence_by_day[d_str][hour_key] += 1
            except ValueError:
                pass
                
    affluence_totals = affluence_by_day["all"].copy()
    
    for day_key in affluence_by_day:
        num_days = len(unique_days[day_key]) if len(unique_days[day_key]) > 0 else 1
        for k in affluence_by_day[day_key]:
            affluence_by_day[day_key][k] = round(affluence_by_day[day_key][k] / num_days, 1)
            
    # Trova le 3 fasce orarie più popolari (su base "all")
    sorted_hours = sorted(affluence_by_day["all"].items(), key=lambda x: x[1], reverse=True)
    peak_hours = [hour for hour, avg in sorted_hours if avg > 0][:3]

    # 3. Servizi e Corsi più popolari
    services_popularity = {}
    courses_popularity = {}
    
    # Inizializza nomi corsi
    for c in uow.courses.get_all():
        courses_popularity[c.name] = 0
        
    # Inizializza nomi servizi benessere
    for w in uow.wellness_services.get_all():
        services_popularity[w.name] = 0
        
    for b in all_bookings:
        try:
            b_date = datetime.strptime(b.booking_date, "%d/%m/%Y").date()
        except ValueError:
            try:
                b_date = datetime.strptime(b.booking_date, "%Y-%m-%d").date()
            except ValueError:
                continue
                
        if pop_start <= b_date <= pop_end:
            if b.service_type == "sauna":
                # Fallback vecchi record
                name = "Sauna Relax & Idromassaggio"
                services_popularity[name] = services_popularity.get(name, 0) + 1
            elif b.service_type == "massage_chair":
                # Fallback vecchi record
                name = "Poltrona Massaggiante Shiatsu"
                services_popularity[name] = services_popularity.get(name, 0) + 1
            elif b.service_type.startswith("wellness:"):
                w_id = b.service_type.split(":")[1]
                ws = uow.wellness_services.get_by_id(w_id)
                if ws:
                    services_popularity[ws.name] = services_popularity.get(ws.name, 0) + 1
            elif b.service_type.startswith("course:"):
                c_id = b.service_type.split(":")[1]
                course = uow.courses.get_by_id(c_id)
                if course:
                    courses_popularity[course.name] = courses_popularity.get(course.name, 0) + 1

    return {
        "financials": {
            "subscriptions": round(revenue_subscriptions, 2),
            "bar": round(revenue_bar, 2),
            "services": round(revenue_services, 2),
            "total": round(revenue_subscriptions + revenue_bar + revenue_services, 2)
        },
        "week_range": week_range_str,
        "dates_by_filter": dates_by_filter,
        "affluence": affluence_by_day,
        "affluence_totals": affluence_totals,
        "peak_hours": peak_hours,
        "popularity": {
            "services": services_popularity,
            "courses": courses_popularity
        }
    }

# --- Gestione Abbonamenti, Corsi, Prodotti (Admin) ---
from typing import Optional

@app.post("/api/subscriptions/types", response_model=schemas.SubscriptionTypeResponse, tags=["Abbonamenti (Admin)"])
def create_or_update_subscription_type(sub_data: schemas.SubscriptionTypeCreate, uow: GymUnitOfWork = Depends(get_uow)):
    sub_type = models.SubscriptionType.from_dict(sub_data.dict())
    saved = uow.subscription_types.save(sub_type)
    
    sub_services = saved.services or []
    has_corsi = "corsi" in sub_services or "vip" in saved.id
    has_servizi = "servizi" in sub_services or "vip" in saved.id

    # Sincronizzazione bidirezionale per i Corsi
    all_courses = uow.courses.get_all()
    for course in all_courses:
        allowed = course.allowed_subscriptions or []
        if has_corsi:
            if saved.id not in allowed:
                allowed.append(saved.id)
                course.allowed_subscriptions = allowed
                uow.courses.save(course)
        else:
            if saved.id in allowed:
                allowed.remove(saved.id)
                course.allowed_subscriptions = allowed
                uow.courses.save(course)

    # Sincronizzazione bidirezionale per i Servizi Benessere
    all_wellness = uow.wellness_services.get_all()
    for service in all_wellness:
        free_subs = service.free_for_subscriptions or []
        if has_servizi:
            if saved.id not in free_subs:
                free_subs.append(saved.id)
                service.free_for_subscriptions = free_subs
                uow.wellness_services.save(service)
        else:
            if saved.id in free_subs:
                free_subs.remove(saved.id)
                service.free_for_subscriptions = free_subs
                uow.wellness_services.save(service)

    return saved

@app.delete("/api/subscriptions/types/{sub_type_id}", tags=["Abbonamenti (Admin)"])
def delete_subscription_type(sub_type_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    # Rimuovi l'abbonamento eliminato da corsi e servizi benessere
    all_courses = uow.courses.get_all()
    for course in all_courses:
        allowed = course.allowed_subscriptions or []
        if sub_type_id in allowed:
            allowed.remove(sub_type_id)
            course.allowed_subscriptions = allowed
            uow.courses.save(course)

    all_wellness = uow.wellness_services.get_all()
    for service in all_wellness:
        free_subs = service.free_for_subscriptions or []
        if sub_type_id in free_subs:
            free_subs.remove(sub_type_id)
            service.free_for_subscriptions = free_subs
            uow.wellness_services.save(service)

    success = uow.subscription_types.delete(sub_type_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tipo di abbonamento non trovato.")
    return {"success": True, "message": "Tipo di abbonamento rimosso con successo."}

@app.post("/api/courses", response_model=schemas.CourseResponse, tags=["Corsi (Admin)"])
def create_or_update_course(course_data: schemas.CourseBase, course_id: Optional[str] = None, uow: GymUnitOfWork = Depends(get_uow)):
    data = course_data.dict()
    if course_id:
        data["id"] = course_id
    course = models.Course.from_dict(data)
    saved = uow.courses.save(course)
    return saved

@app.delete("/api/courses/{course_id}", tags=["Corsi (Admin)"])
def delete_course(course_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    success = uow.courses.delete(course_id)
    if not success:
        raise HTTPException(status_code=404, detail="Corso non trovato.")
        
    # Rimuovi prenotazioni associate
    for b in uow.bookings.get_all():
        if b.service_type == f"course:{course_id}":
            uow.bookings.delete(b.id)
            
    return {"success": True, "message": "Corso rimosso con successo."}

@app.post("/api/products", response_model=schemas.ProductResponse, tags=["Smart Bar (Admin)"])
def create_or_update_product(prod_data: schemas.ProductBase, product_id: Optional[str] = None, uow: GymUnitOfWork = Depends(get_uow)):
    data = prod_data.dict()
    if product_id:
        data["id"] = product_id
    product = models.Product.from_dict(data)
    saved = uow.products.save(product)
    return saved

@app.delete("/api/products/{product_id}", tags=["Smart Bar (Admin)"])
def delete_product(product_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    success = uow.products.delete(product_id)
    if not success:
        raise HTTPException(status_code=404, detail="Prodotto non trovato.")
    return {"success": True, "message": "Prodotto rimosso con successo."}


# =====================================================================
# SERVE FILE STATICI PER LA DASHBOARD
# =====================================================================

# Monta la cartella static
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    # Redirect automatico all'index.html statico
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/static/index.html")


@app.get("/api/wellness-services", response_model=List[schemas.WellnessServiceResponse], tags=["Servizi Benessere"])
def get_wellness_services(date: Optional[str] = Query(None), uow: GymUnitOfWork = Depends(get_uow)):
    services = uow.wellness_services.get_all()
    all_bookings = uow.bookings.get_all() if date else []

    DAYS_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
    target_day_code = None
    if date:
        try:
            target_date_obj = datetime.strptime(date, "%Y-%m-%d").date()
            target_day_code = DAYS_MAP[target_date_obj.weekday()]
        except ValueError:
            pass

    result = []
    for s in services:
        s_dict = s.to_dict()
        ws = s.weekly_schedule or {}
        
        if date and target_day_code:
            day_slots = ws.get(target_day_code, [])
            if not day_slots:
                s_dict["booked_count"] = 0
                s_dict["available_seats"] = 0
                s_dict["slot_availabilities"] = {}
            else:
                target_service = f"wellness:{s.id}"
                slot_avail = {}
                total_avail = 0
                total_booked = 0
                for slot in day_slots:
                    booked = sum(
                        1 for b in all_bookings 
                        if (b.service_type == target_service or b.service_type == s.id) 
                        and b.booking_date == date 
                        and b.time_slot == slot
                    )
                    avail = max(0, s.max_capacity - booked)
                    slot_avail[slot] = {
                        "booked_count": booked,
                        "available_seats": avail,
                        "max_capacity": s.max_capacity
                    }
                    total_avail += avail
                    total_booked += booked
                s_dict["booked_count"] = total_booked
                s_dict["available_seats"] = total_avail
                s_dict["slot_availabilities"] = slot_avail
        else:
            s_dict["booked_count"] = 0
            s_dict["available_seats"] = s.max_capacity
            s_dict["slot_availabilities"] = {}
        result.append(s_dict)
    return result

@app.post("/api/wellness-services", response_model=schemas.WellnessServiceResponse, tags=["Servizi Benessere (Admin)"])
def create_or_update_wellness_service(service_data: schemas.WellnessServiceBase, service_id: Optional[str] = None, uow: GymUnitOfWork = Depends(get_uow)):
    data = service_data.dict()
    if service_id:
        data["id"] = service_id
    service = models.WellnessService.from_dict(data)
    saved = uow.wellness_services.save(service)
    return saved

@app.delete("/api/wellness-services/{service_id}", tags=["Servizi Benessere (Admin)"])
def delete_wellness_service(service_id: str, uow: GymUnitOfWork = Depends(get_uow)):
    success = uow.wellness_services.delete(service_id)
    if not success:
        raise HTTPException(status_code=404, detail="Servizio benessere non trovato.")
        
    # Rimuovi prenotazioni associate
    for b in uow.bookings.get_all():
        if b.service_type == f"wellness:{service_id}":
            uow.bookings.delete(b.id)
            
    return {"success": True, "message": "Servizio benessere rimosso con successo."}
