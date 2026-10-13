from pydantic import BaseModel, EmailStr
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    stock:int 
class ProductResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    price: float
    stock:int 
    class Config:from_attributes = True
class CartCreate(BaseModel):
    product_id: int
    quantity: int


class CartUpdate(BaseModel):
    quantity: int


class CartResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    product_name: str
    price: float
    total: float
class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    price: float


class OrderResponse(BaseModel):
    id: int
    total_amount: float
    status: str
    created_at: datetime
    items: list[OrderItemResponse]