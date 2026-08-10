from pydantic import BaseModel, EmailStr
from typing import List, Optional

# --- Member Schemas ---
class MemberBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    fiscal_code: Optional[str] = None

class MemberCreate(MemberBase):
    password: str

class MemberUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    fiscal_code: Optional[str] = None
    is_active: Optional[bool] = None

class MemberResponse(MemberBase):
    id: str
    balance: float
    is_active: bool

    class Config:
        from_attributes = True


# --- SubscriptionType Schemas ---
class SubscriptionTypeBase(BaseModel):
    id: str
    name: str
    price: float
    duration_days: int
    services: List[str]

class SubscriptionTypeCreate(SubscriptionTypeBase):
    pass

class SubscriptionTypeResponse(SubscriptionTypeBase):
    class Config:
        from_attributes = True


# --- MemberSubscription Schemas ---
class MemberSubscriptionCreate(BaseModel):
    member_id: str
    subscription_type_id: str
    start_date: str  # YYYY-MM-DD

class MemberSubscriptionResponse(BaseModel):
    id: str
    member_id: str
    subscription_type_id: str
    start_date: str
    end_date: str
    is_active: bool

    class Config:
        from_attributes = True


# --- Course Schemas ---
class CourseBase(BaseModel):
    name: str
    trainer: str
    schedule: str
    max_capacity: int
    allowed_subscriptions: List[str]

class CourseCreate(CourseBase):
    pass

class CourseResponse(CourseBase):
    id: str

    class Config:
        from_attributes = True


# --- Booking Schemas ---
class BookingCreate(BaseModel):
    member_id: str
    service_type: str  # e.g., "sauna", "massage_chair", "course:<id>"
    booking_date: str  # YYYY-MM-DD
    time_slot: str     # e.g., "10:00 - 11:00"

class BookingResponse(BaseModel):
    id: str
    member_id: str
    service_type: str
    booking_date: str
    time_slot: str
    cost: float

    class Config:
        from_attributes = True


# --- Product Schemas ---
class ProductBase(BaseModel):
    name: str
    price: float
    stock: int

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: str

    class Config:
        from_attributes = True


# --- Purchase Schemas ---
class PurchaseCreate(BaseModel):
    member_id: str
    product_id: str

class PurchaseResponse(BaseModel):
    id: str
    member_id: str
    product_name: str
    price: float
    purchase_date: str

    class Config:
        from_attributes = True


# --- AccessLog Schemas ---
class AccessLogResponse(BaseModel):
    id: str
    member_id: str
    timestamp: str
    is_allowed: bool
    reason: str

    class Config:
        from_attributes = True


# --- Custom Action Schemas ---
class CheckInRequest(BaseModel):
    member_id_or_email: str

class CheckInResponse(BaseModel):
    is_allowed: bool
    member_name: str
    reason: str
    timestamp: str

class RicaricaRequest(BaseModel):
    amount: float


# --- Admin Subscription History Schemas ---
class AdminSubscriptionHistoryMember(BaseModel):
    member_id: str
    first_name: str
    last_name: str
    email: str
    subscriptions: List[MemberSubscriptionResponse]
