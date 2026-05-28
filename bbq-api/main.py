from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
import asyncpg
import os
from datetime import date
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="BBQ Factory OS API", version="1.0.0")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc.errors())},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pool: asyncpg.Pool = None

async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", 5432)),
            database=os.getenv("DB_NAME", "bbq_factory"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASS"),
            min_size=2,
            max_size=10,
        )
    return pool

@app.on_event("startup")
async def startup():
    await get_pool()

@app.on_event("shutdown")
async def shutdown():
    if pool:
        await pool.close()

def current_cycle() -> str:
    return "1-15" if date.today().day <= 15 else "16-кін"

def cycle_date_range():
    import calendar
    today = date.today()
    if today.day <= 15:
        return today.replace(day=1), today.replace(day=15)
    last_day = calendar.monthrange(today.year, today.month)[1]
    return today.replace(day=16), today.replace(day=last_day)

# ─── AUTHENTICATION (New 'users' Table) ──────────────────────────────────────────
class UserOut(BaseModel):
    tid:  int
    name: str
    role: str

class RegisterBody(BaseModel):
    name:     str
    role:     str  
    pin_code: str
    tid:      Optional[int] = None

class LoginBody(BaseModel):
    tid: int
    pin_code: str

@app.get("/api/auth/users", response_model=List[UserOut])
async def get_users():
    p = await get_pool()
    rows = await p.fetch("SELECT tid, name, role FROM public.masters ORDER BY name")
    return [dict(r) for r in rows]

import random

@app.post("/api/auth/register", response_model=UserOut)
async def register_user(body: RegisterBody):
    print(f"DEBUG: Body received: {body}")
    p = await get_pool()
    # Перевірка чи ім'я вже існує
    existing = await p.fetchrow("SELECT tid FROM public.masters WHERE name = $1", body.name)
    if existing:
        raise HTTPException(status_code=400, detail="Користувач з таким іменем вже існує")
    
    # Генеруємо tid як INT
    effective_tid = body.tid if body.tid else random.randint(100000, 999999)
    
    row = await p.fetchrow("""
        INSERT INTO public.masters (tid, name, role, pin_code)
        VALUES ($1, $2, $3, $4)
        RETURNING tid, name, role
    """, int(effective_tid), body.name, body.role, body.pin_code)
    
    return dict(row)

@app.post("/api/auth/login", response_model=UserOut)
async def login_user(body: LoginBody):
    p = await get_pool()
    row = await p.fetchrow("""
        SELECT tid, name, role 
        FROM public.masters
        WHERE tid = $1 AND pin_code = $2
    """, body.tid, body.pin_code)
    if not row:
        raise HTTPException(status_code=401, detail="Невірний пін-код")
    return dict(row)

# ─── EXISTING API ENDPOINTS (Mapped to Users where applicable) ──────────────────
# ... (залишаю попередні ендпоінти, але враховую, що авторизація тепер інакша)
# Примітка: Логіка get_dashboard/get_master_logs залишається прив'язаною до імені майстра, тому змін у SQL не потрібно.
