import os
import json
from abc import ABC, abstractmethod
from typing import List, Optional
from sqlalchemy.orm import Session
import config
from models import Base, Member, SubscriptionType, MemberSubscription, Course, Booking, Product, Purchase, AccessLog

# ==========================================
# 1. INTERFACCE ASTRATTE (REPOSITORY PATTERN)
# ==========================================

class IMemberRepository(ABC):
    @abstractmethod
    def get_by_id(self, id: str) -> Optional[Member]: pass
    @abstractmethod
    def get_by_email(self, email: str) -> Optional[Member]: pass
    @abstractmethod
    def get_all(self) -> List[Member]: pass
    @abstractmethod
    def save(self, member: Member) -> Member: pass
    @abstractmethod
    def delete(self, id: str) -> bool: pass

class ISubscriptionTypeRepository(ABC):
    @abstractmethod
    def get_by_id(self, id: str) -> Optional[SubscriptionType]: pass
    @abstractmethod
    def get_all(self) -> List[SubscriptionType]: pass
    @abstractmethod
    def save(self, sub_type: SubscriptionType) -> SubscriptionType: pass
    @abstractmethod
    def delete(self, id: str) -> bool: pass

class IMemberSubscriptionRepository(ABC):
    @abstractmethod
    def get_by_id(self, id: str) -> Optional[MemberSubscription]: pass
    @abstractmethod
    def get_by_member_id(self, member_id: str) -> List[MemberSubscription]: pass
    @abstractmethod
    def get_all(self) -> List[MemberSubscription]: pass
    @abstractmethod
    def save(self, sub: MemberSubscription) -> MemberSubscription: pass

class ICourseRepository(ABC):
    @abstractmethod
    def get_by_id(self, id: str) -> Optional[Course]: pass
    @abstractmethod
    def get_all(self) -> List[Course]: pass
    @abstractmethod
    def save(self, course: Course) -> Course: pass
    @abstractmethod
    def delete(self, id: str) -> bool: pass

class IBookingRepository(ABC):
    @abstractmethod
    def get_by_id(self, id: str) -> Optional[Booking]: pass
    @abstractmethod
    def get_by_member_id(self, member_id: str) -> List[Booking]: pass
    @abstractmethod
    def get_all(self) -> List[Booking]: pass
    @abstractmethod
    def save(self, booking: Booking) -> Booking: pass
    @abstractmethod
    def delete(self, id: str) -> bool: pass

class IProductRepository(ABC):
    @abstractmethod
    def get_by_id(self, id: str) -> Optional[Product]: pass
    @abstractmethod
    def get_all(self) -> List[Product]: pass
    @abstractmethod
    def save(self, product: Product) -> Product: pass
    @abstractmethod
    def delete(self, id: str) -> bool: pass

class IPurchaseRepository(ABC):
    @abstractmethod
    def get_by_id(self, id: str) -> Optional[Purchase]: pass
    @abstractmethod
    def get_by_member_id(self, member_id: str) -> List[Purchase]: pass
    @abstractmethod
    def get_all(self) -> List[Purchase]: pass
    @abstractmethod
    def save(self, purchase: Purchase) -> Purchase: pass

class IAccessLogRepository(ABC):
    @abstractmethod
    def get_all(self) -> List[AccessLog]: pass
    @abstractmethod
    def save(self, log: AccessLog) -> AccessLog: pass

# ==========================================
# 2. IMPLEMENTAZIONE JSON (PERSISTENZA SU FILE)
# ==========================================

class JSONRepositoryBase:
    def __init__(self, filename: str):
        if not os.path.exists(config.JSON_DATA_DIR):
            os.makedirs(config.JSON_DATA_DIR)
        self.filepath = os.path.join(config.JSON_DATA_DIR, filename)
        if not os.path.exists(self.filepath):
            with open(self.filepath, "w") as f:
                json.dump([], f)

    def _load_all(self) -> list:
        try:
            with open(self.filepath, "r") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_all(self, data: list):
        with open(self.filepath, "w") as f:
            json.dump(data, f, indent=4)


class JSONMemberRepository(JSONRepositoryBase, IMemberRepository):
    def __init__(self):
        super().__init__("members.json")

    def get_by_id(self, id: str) -> Optional[Member]:
        items = self._load_all()
        for item in items:
            if item["id"] == id:
                return Member.from_dict(item)
        return None

    def get_by_email(self, email: str) -> Optional[Member]:
        items = self._load_all()
        for item in items:
            if item["email"].lower() == email.lower():
                return Member.from_dict(item)
        return None

    def get_all(self) -> List[Member]:
        return [Member.from_dict(item) for item in self._load_all()]

    def save(self, member: Member) -> Member:
        items = self._load_all()
        member_dict = member.to_dict()
        
        # Check if updating or inserting
        updated = False
        for i, item in enumerate(items):
            if item["id"] == member.id:
                items[i] = member_dict
                updated = True
                break
        if not updated:
            items.append(member_dict)
            
        self._save_all(items)
        return member

    def delete(self, id: str) -> bool:
        items = self._load_all()
        initial_len = len(items)
        items = [item for item in items if item["id"] != id]
        self._save_all(items)
        return len(items) < initial_len


class JSONSubscriptionTypeRepository(JSONRepositoryBase, ISubscriptionTypeRepository):
    def __init__(self):
        super().__init__("subscription_types.json")

    def get_by_id(self, id: str) -> Optional[SubscriptionType]:
        items = self._load_all()
        for item in items:
            if item["id"] == id:
                return SubscriptionType.from_dict(item)
        return None

    def get_all(self) -> List[SubscriptionType]:
        return [SubscriptionType.from_dict(item) for item in self._load_all()]

    def save(self, sub_type: SubscriptionType) -> SubscriptionType:
        items = self._load_all()
        sub_dict = sub_type.to_dict()
        updated = False
        for i, item in enumerate(items):
            if item["id"] == sub_type.id:
                items[i] = sub_dict
                updated = True
                break
        if not updated:
            items.append(sub_dict)
        self._save_all(items)
        return sub_type

    def delete(self, id: str) -> bool:
        items = self._load_all()
        initial_len = len(items)
        items = [item for item in items if item["id"] != id]
        self._save_all(items)
        return len(items) < initial_len


class JSONMemberSubscriptionRepository(JSONRepositoryBase, IMemberSubscriptionRepository):
    def __init__(self):
        super().__init__("member_subscriptions.json")

    def get_by_id(self, id: str) -> Optional[MemberSubscription]:
        items = self._load_all()
        for item in items:
            if item["id"] == id:
                return MemberSubscription.from_dict(item)
        return None

    def get_by_member_id(self, member_id: str) -> List[MemberSubscription]:
        items = self._load_all()
        return [MemberSubscription.from_dict(item) for item in items if item["member_id"] == member_id]

    def get_all(self) -> List[MemberSubscription]:
        return [MemberSubscription.from_dict(item) for item in self._load_all()]

    def save(self, sub: MemberSubscription) -> MemberSubscription:
        items = self._load_all()
        sub_dict = sub.to_dict()
        updated = False
        for i, item in enumerate(items):
            if item["id"] == sub.id:
                items[i] = sub_dict
                updated = True
                break
        if not updated:
            items.append(sub_dict)
        self._save_all(items)
        return sub


class JSONCourseRepository(JSONRepositoryBase, ICourseRepository):
    def __init__(self):
        super().__init__("courses.json")

    def get_by_id(self, id: str) -> Optional[Course]:
        items = self._load_all()
        for item in items:
            if item["id"] == id:
                return Course.from_dict(item)
        return None

    def get_all(self) -> List[Course]:
        return [Course.from_dict(item) for item in self._load_all()]

    def save(self, course: Course) -> Course:
        items = self._load_all()
        course_dict = course.to_dict()
        updated = False
        for i, item in enumerate(items):
            if item["id"] == course.id:
                items[i] = course_dict
                updated = True
                break
        if not updated:
            items.append(course_dict)
        self._save_all(items)
        return course

    def delete(self, id: str) -> bool:
        items = self._load_all()
        initial_len = len(items)
        items = [item for item in items if item["id"] != id]
        self._save_all(items)
        return len(items) < initial_len


class JSONBookingRepository(JSONRepositoryBase, IBookingRepository):
    def __init__(self):
        super().__init__("bookings.json")

    def get_by_id(self, id: str) -> Optional[Booking]:
        items = self._load_all()
        for item in items:
            if item["id"] == id:
                return Booking.from_dict(item)
        return None

    def get_by_member_id(self, member_id: str) -> List[Booking]:
        items = self._load_all()
        return [Booking.from_dict(item) for item in items if item["member_id"] == member_id]

    def get_all(self) -> List[Booking]:
        return [Booking.from_dict(item) for item in self._load_all()]

    def save(self, booking: Booking) -> Booking:
        items = self._load_all()
        b_dict = booking.to_dict()
        updated = False
        for i, item in enumerate(items):
            if item["id"] == booking.id:
                items[i] = b_dict
                updated = True
                break
        if not updated:
            items.append(b_dict)
        self._save_all(items)
        return booking

    def delete(self, id: str) -> bool:
        items = self._load_all()
        initial_len = len(items)
        items = [item for item in items if item["id"] != id]
        self._save_all(items)
        return len(items) < initial_len


class JSONProductRepository(JSONRepositoryBase, IProductRepository):
    def __init__(self):
        super().__init__("products.json")

    def get_by_id(self, id: str) -> Optional[Product]:
        items = self._load_all()
        for item in items:
            if item["id"] == id:
                return Product.from_dict(item)
        return None

    def get_all(self) -> List[Product]:
        return [Product.from_dict(item) for item in self._load_all()]

    def save(self, product: Product) -> Product:
        items = self._load_all()
        p_dict = product.to_dict()
        updated = False
        for i, item in enumerate(items):
            if item["id"] == product.id:
                items[i] = p_dict
                updated = True
                break
        if not updated:
            items.append(p_dict)
        self._save_all(items)
        return product

    def delete(self, id: str) -> bool:
        items = self._load_all()
        initial_len = len(items)
        items = [item for item in items if item["id"] != id]
        self._save_all(items)
        return len(items) < initial_len


class JSONPurchaseRepository(JSONRepositoryBase, IPurchaseRepository):
    def __init__(self):
        super().__init__("purchases.json")

    def get_by_id(self, id: str) -> Optional[Purchase]:
        items = self._load_all()
        for item in items:
            if item["id"] == id:
                return Purchase.from_dict(item)
        return None

    def get_by_member_id(self, member_id: str) -> List[Purchase]:
        items = self._load_all()
        return [Purchase.from_dict(item) for item in items if item["member_id"] == member_id]

    def get_all(self) -> List[Purchase]:
        return [Purchase.from_dict(item) for item in self._load_all()]

    def save(self, purchase: Purchase) -> Purchase:
        items = self._load_all()
        p_dict = purchase.to_dict()
        updated = False
        for i, item in enumerate(items):
            if item["id"] == purchase.id:
                items[i] = p_dict
                updated = True
                break
        if not updated:
            items.append(p_dict)
        self._save_all(items)
        return purchase


class JSONAccessLogRepository(JSONRepositoryBase, IAccessLogRepository):
    def __init__(self):
        super().__init__("access_logs.json")

    def get_all(self) -> List[AccessLog]:
        return [AccessLog.from_dict(item) for item in self._load_all()]

    def save(self, log: AccessLog) -> AccessLog:
        items = self._load_all()
        items.append(log.to_dict())
        self._save_all(items)
        return log


# ==========================================
# 3. IMPLEMENTAZIONE SQLITE (CON SQLALCHEMY)
# ==========================================

class SQLiteMemberRepository(IMemberRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: str) -> Optional[Member]:
        return self.db.query(Member).filter(Member.id == id).first()

    def get_by_email(self, email: str) -> Optional[Member]:
        return self.db.query(Member).filter(Member.email == email).first()

    def get_all(self) -> List[Member]:
        return self.db.query(Member).all()

    def save(self, member: Member) -> Member:
        existing = self.get_by_id(member.id)
        if existing:
            # SQLAlchemy handles updates via object tracking, but if detached we merge
            merged = self.db.merge(member)
            self.db.commit()
            return merged
        else:
            self.db.add(member)
            self.db.commit()
            self.db.refresh(member)
            return member

    def delete(self, id: str) -> bool:
        member = self.get_by_id(id)
        if member:
            self.db.delete(member)
            self.db.commit()
            return True
        return False


class SQLiteSubscriptionTypeRepository(ISubscriptionTypeRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: str) -> Optional[SubscriptionType]:
        return self.db.query(SubscriptionType).filter(SubscriptionType.id == id).first()

    def get_all(self) -> List[SubscriptionType]:
        return self.db.query(SubscriptionType).all()

    def save(self, sub_type: SubscriptionType) -> SubscriptionType:
        existing = self.get_by_id(sub_type.id)
        if existing:
            merged = self.db.merge(sub_type)
            self.db.commit()
            return merged
        else:
            self.db.add(sub_type)
            self.db.commit()
            self.db.refresh(sub_type)
            return sub_type

    def delete(self, id: str) -> bool:
        sub_type = self.get_by_id(id)
        if sub_type:
            self.db.delete(sub_type)
            self.db.commit()
            return True
        return False


class SQLiteMemberSubscriptionRepository(IMemberSubscriptionRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: str) -> Optional[MemberSubscription]:
        return self.db.query(MemberSubscription).filter(MemberSubscription.id == id).first()

    def get_by_member_id(self, member_id: str) -> List[MemberSubscription]:
        return self.db.query(MemberSubscription).filter(MemberSubscription.member_id == member_id).all()

    def get_all(self) -> List[MemberSubscription]:
        return self.db.query(MemberSubscription).all()

    def save(self, sub: MemberSubscription) -> MemberSubscription:
        existing = self.get_by_id(sub.id)
        if existing:
            merged = self.db.merge(sub)
            self.db.commit()
            return merged
        else:
            self.db.add(sub)
            self.db.commit()
            self.db.refresh(sub)
            return sub


class SQLiteCourseRepository(ICourseRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: str) -> Optional[Course]:
        return self.db.query(Course).filter(Course.id == id).first()

    def get_all(self) -> List[Course]:
        return self.db.query(Course).all()

    def save(self, course: Course) -> Course:
        existing = self.get_by_id(course.id)
        if existing:
            merged = self.db.merge(course)
            self.db.commit()
            return merged
        else:
            self.db.add(course)
            self.db.commit()
            self.db.refresh(course)
            return course

    def delete(self, id: str) -> bool:
        course = self.get_by_id(id)
        if course:
            self.db.delete(course)
            self.db.commit()
            return True
        return False


class SQLiteBookingRepository(IBookingRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: str) -> Optional[Booking]:
        return self.db.query(Booking).filter(Booking.id == id).first()

    def get_by_member_id(self, member_id: str) -> List[Booking]:
        return self.db.query(Booking).filter(Booking.member_id == member_id).all()

    def get_all(self) -> List[Booking]:
        return self.db.query(Booking).all()

    def save(self, booking: Booking) -> Booking:
        existing = self.get_by_id(booking.id)
        if existing:
            merged = self.db.merge(booking)
            self.db.commit()
            return merged
        else:
            self.db.add(booking)
            self.db.commit()
            self.db.refresh(booking)
            return booking

    def delete(self, id: str) -> bool:
        booking = self.get_by_id(id)
        if booking:
            self.db.delete(booking)
            self.db.commit()
            return True
        return False


class SQLiteProductRepository(IProductRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: str) -> Optional[Product]:
        return self.db.query(Product).filter(Product.id == id).first()

    def get_all(self) -> List[Product]:
        return self.db.query(Product).all()

    def save(self, product: Product) -> Product:
        existing = self.get_by_id(product.id)
        if existing:
            merged = self.db.merge(product)
            self.db.commit()
            return merged
        else:
            self.db.add(product)
            self.db.commit()
            self.db.refresh(product)
            return product

    def delete(self, id: str) -> bool:
        product = self.get_by_id(id)
        if product:
            self.db.delete(product)
            self.db.commit()
            return True
        return False


class SQLitePurchaseRepository(IPurchaseRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: str) -> Optional[Purchase]:
        return self.db.query(Purchase).filter(Purchase.id == id).first()

    def get_by_member_id(self, member_id: str) -> List[Purchase]:
        return self.db.query(Purchase).filter(Purchase.member_id == member_id).all()

    def get_all(self) -> List[Purchase]:
        return self.db.query(Purchase).all()

    def save(self, purchase: Purchase) -> Purchase:
        existing = self.get_by_id(purchase.id)
        if existing:
            merged = self.db.merge(purchase)
            self.db.commit()
            return merged
        else:
            self.db.add(purchase)
            self.db.commit()
            self.db.refresh(purchase)
            return purchase


class SQLiteAccessLogRepository(IAccessLogRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[AccessLog]:
        return self.db.query(AccessLog).all()

    def save(self, log: AccessLog) -> AccessLog:
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log


# ==========================================
# 4. GESTORE DEI REPOSITORY (UNIT OF WORK / MANAGER)
# ==========================================

class GymUnitOfWork:
    """
    Contiene le istanze di tutti i repository attivi.
    Si occupa di inizializzare la connessione (JSON o SQLite) e fornire i repository corretti.
    """
    def __init__(self, db_session: Optional[Session] = None):
        self.db_session = db_session
        
        if config.REPOSITORY_TYPE == "SQLITE":
            if not db_session:
                raise ValueError("La sessione del DB è richiesta in modalità SQLITE.")
            self.members = SQLiteMemberRepository(db_session)
            self.subscription_types = SQLiteSubscriptionTypeRepository(db_session)
            self.subscriptions = SQLiteMemberSubscriptionRepository(db_session)
            self.courses = SQLiteCourseRepository(db_session)
            self.bookings = SQLiteBookingRepository(db_session)
            self.products = SQLiteProductRepository(db_session)
            self.purchases = SQLitePurchaseRepository(db_session)
            self.access_logs = SQLiteAccessLogRepository(db_session)
        else:
            self.members = JSONMemberRepository()
            self.subscription_types = JSONSubscriptionTypeRepository()
            self.subscriptions = JSONMemberSubscriptionRepository()
            self.courses = JSONCourseRepository()
            self.bookings = JSONBookingRepository()
            self.products = JSONProductRepository()
            self.purchases = JSONPurchaseRepository()
            self.access_logs = JSONAccessLogRepository()
            
            # Popola dati iniziali se vuoti per simulazione
            self._seed_initial_data()

    def _seed_initial_data(self):
        # Tipi di Abbonamento di default se la tabella è vuota
        if not self.subscription_types.get_all():
            self.subscription_types.save(SubscriptionType.from_dict({
                "id": "basic",
                "name": "Abbonamento Basic (Solo Sala Pesi)",
                "price": 39.99,
                "duration_days": 30,
                "services": ["sala_pesi"]
            }))
            self.subscription_types.save(SubscriptionType.from_dict({
                "id": "premium",
                "name": "Abbonamento Premium (Sala + Corsi)",
                "price": 54.99,
                "duration_days": 30,
                "services": ["sala_pesi", "corsi"]
            }))
            self.subscription_types.save(SubscriptionType.from_dict({
                "id": "vip",
                "name": "Abbonamento VIP (Tutto Incluso)",
                "price": 79.99,
                "duration_days": 30,
                "services": ["sala_pesi", "corsi", "sauna", "massage_chair"]
            }))
            
        # Prodotti bar di default
        if not self.products.get_all():
            self.products.save(Product.from_dict({"id": "p1", "name": "Acqua Minerale 500ml", "price": 1.00, "stock": 100}))
            self.products.save(Product.from_dict({"id": "p2", "name": "Bevanda Energetica", "price": 2.50, "stock": 50}))
            self.products.save(Product.from_dict({"id": "p3", "name": "Barretta Proteica Cacao", "price": 2.00, "stock": 40}))
            self.products.save(Product.from_dict({"id": "p4", "name": "Frullato Proteico Banana", "price": 3.50, "stock": 20}))
            
        # Corsi di default
        if not self.courses.get_all():
            self.courses.save(Course.from_dict({
                "id": "c1",
                "name": "Corso Spinning",
                "trainer": "Marco Rossi",
                "schedule": "Lun, Mer 18:00 - 19:00",
                "max_capacity": 15,
                "allowed_subscriptions": ["premium", "vip"]
            }))
            self.courses.save(Course.from_dict({
                "id": "c2",
                "name": "Yoga Vinyasa",
                "trainer": "Laura Bianchi",
                "schedule": "Mar, Gio 09:00 - 10:00",
                "max_capacity": 12,
                "allowed_subscriptions": ["premium", "vip"]
            }))
            self.courses.save(Course.from_dict({
                "id": "c3",
                "name": "Crossfit Base",
                "trainer": "Giovanni Neri",
                "schedule": "Lun, Ven 19:30 - 20:30",
                "max_capacity": 10,
                "allowed_subscriptions": ["premium", "vip"]
            }))
