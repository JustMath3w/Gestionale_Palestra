import uuid
import random
from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Member(Base):
    __tablename__ = "members"

    id = Column(String, primary_key=True, default=lambda: str(random.randint(100000, 999999)))
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    fiscal_code = Column(String, nullable=True)
    balance = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        if not self.id:
            self.id = str(random.randint(100000, 999999))
        return {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.email,
            "password_hash": self.password_hash,
            "phone": self.phone,
            "fiscal_code": self.fiscal_code,
            "balance": self.balance,
            "is_active": self.is_active
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id"),
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            email=data.get("email"),
            password_hash=data.get("password_hash"),
            phone=data.get("phone"),
            fiscal_code=data.get("fiscal_code"),
            balance=data.get("balance", 0.0),
            is_active=data.get("is_active", True)
        )


class SubscriptionType(Base):
    __tablename__ = "subscription_types"

    id = Column(String, primary_key=True)  # e.g., 'basic', 'premium', 'vip'
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    duration_days = Column(Integer, nullable=False)
    # Comma-separated list of services (e.g., "sala_pesi,corsi,sauna")
    services_str = Column(String, default="")

    @property
    def services(self):
        return [s.strip() for s in self.services_str.split(",") if s.strip()] if self.services_str else []

    @services.setter
    def services(self, value):
        self.services_str = ",".join(value) if value else ""

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "duration_days": self.duration_days,
            "services": self.services
        }

    @classmethod
    def from_dict(cls, data):
        obj = cls(
            id=data.get("id"),
            name=data.get("name"),
            price=data.get("price"),
            duration_days=data.get("duration_days"),
        )
        obj.services = data.get("services", [])
        return obj


class MemberSubscription(Base):
    __tablename__ = "member_subscriptions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    subscription_type_id = Column(String, ForeignKey("subscription_types.id"), nullable=False)
    start_date = Column(String, nullable=False)  # YYYY-MM-DD
    end_date = Column(String, nullable=False)    # YYYY-MM-DD
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        return {
            "id": self.id,
            "member_id": self.member_id,
            "subscription_type_id": self.subscription_type_id,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "is_active": self.is_active
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id"),
            member_id=data.get("member_id"),
            subscription_type_id=data.get("subscription_type_id"),
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
            is_active=data.get("is_active", True)
        )


class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    trainer = Column(String, nullable=False)
    schedule = Column(String, nullable=False)  # e.g., "Lun, Mer 18:00"
    max_capacity = Column(Integer, nullable=False)
    # Comma-separated list of allowed subscription ids (e.g., "premium,vip")
    allowed_subscriptions_str = Column(String, default="")

    @property
    def allowed_subscriptions(self):
        return [s.strip() for s in self.allowed_subscriptions_str.split(",") if s.strip()] if self.allowed_subscriptions_str else []

    @allowed_subscriptions.setter
    def allowed_subscriptions(self, value):
        self.allowed_subscriptions_str = ",".join(value) if value else ""

    def to_dict(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        return {
            "id": self.id,
            "name": self.name,
            "trainer": self.trainer,
            "schedule": self.schedule,
            "max_capacity": self.max_capacity,
            "allowed_subscriptions": self.allowed_subscriptions
        }

    @classmethod
    def from_dict(cls, data):
        obj = cls(
            id=data.get("id"),
            name=data.get("name"),
            trainer=data.get("trainer"),
            schedule=data.get("schedule"),
            max_capacity=data.get("max_capacity")
        )
        obj.allowed_subscriptions = data.get("allowed_subscriptions", [])
        return obj


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    service_type = Column(String, nullable=False)  # e.g. "sauna", "massage_chair", "course:<course_id>"
    booking_date = Column(String, nullable=False)  # YYYY-MM-DD
    time_slot = Column(String, nullable=False)     # e.g. "10:00 - 11:00"
    cost = Column(Float, default=0.0)

    def to_dict(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        return {
            "id": self.id,
            "member_id": self.member_id,
            "service_type": self.service_type,
            "booking_date": self.booking_date,
            "time_slot": self.time_slot,
            "cost": self.cost
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id"),
            member_id=data.get("member_id"),
            service_type=data.get("service_type"),
            booking_date=data.get("booking_date"),
            time_slot=data.get("time_slot"),
            cost=data.get("cost", 0.0)
        )


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    stock = Column(Integer, default=0)

    def to_dict(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "stock": self.stock
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id"),
            name=data.get("name"),
            price=data.get("price"),
            stock=data.get("stock", 0)
        )


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    product_name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    purchase_date = Column(String, nullable=False)  # YYYY-MM-DD HH:MM:SS

    def to_dict(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        return {
            "id": self.id,
            "member_id": self.member_id,
            "product_name": self.product_name,
            "price": self.price,
            "purchase_date": self.purchase_date
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id"),
            member_id=data.get("member_id"),
            product_name=data.get("product_name"),
            price=data.get("price"),
            purchase_date=data.get("purchase_date")
        )


class AccessLog(Base):
    __tablename__ = "access_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    member_id = Column(String, nullable=False)  # Can be ID or "Unknown"
    timestamp = Column(String, nullable=False)   # YYYY-MM-DD HH:MM:SS
    is_allowed = Column(Boolean, nullable=False)
    reason = Column(String, nullable=False)

    def to_dict(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        return {
            "id": self.id,
            "member_id": self.member_id,
            "timestamp": self.timestamp,
            "is_allowed": self.is_allowed,
            "reason": self.reason
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id"),
            member_id=data.get("member_id"),
            timestamp=data.get("timestamp"),
            is_allowed=data.get("is_allowed"),
            reason=data.get("reason")
        )

class Staff(Base):
    __tablename__ = "staff"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="admin")

    def to_dict(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "password_hash": self.password_hash,
            "role": self.role
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id"),
            username=data.get("username"),
            email=data.get("email"),
            password_hash=data.get("password_hash"),
            role=data.get("role", "admin")
        )
