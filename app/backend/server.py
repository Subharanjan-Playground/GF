from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, uuid, logging, bcrypt, jwt
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'nexusarena-dev-secret-change-me')
JWT_ALG = 'HS256'
TOKEN_DAYS = 30

app = FastAPI()
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nexusarena")

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def new_id():
    return str(uuid.uuid4())

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def check_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_token(user):
    payload = {"sub": user["id"], "role": user["role"],
               "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def clean(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc

# ---------------- Models ----------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class CustomerIn(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None

class SessionStartIn(BaseModel):
    shop_id: str
    station_id: str
    customer_id: str
    game_id: Optional[str] = None
    duration_minutes: int = 60
    payment_method: str = "cash"

class ExtendIn(BaseModel):
    minutes: int

class SnackItem(BaseModel):
    product_id: str
    qty: int

class AddSnacksIn(BaseModel):
    items: List[SnackItem]

class POSCheckoutIn(BaseModel):
    shop_id: str
    items: List[SnackItem]
    payment_method: str = "cash"
    customer_id: Optional[str] = None
    session_id: Optional[str] = None

class BookingIn(BaseModel):
    shop_id: str
    station_id: str
    customer_id: str
    game_id: Optional[str] = None
    date: str
    start_time: str
    end_time: str

class StationIn(BaseModel):
    shop_id: str
    name: str
    type: str = "PS5"
    hourly_rate: float = 150
    description: Optional[str] = ""
    status: str = "free"

class GameIn(BaseModel):
    name: str
    platform: str = "PlayStation"
    genre: Optional[str] = ""
    active: bool = True

class ProductAdjustIn(BaseModel):
    delta: int
    movement_type: str = "ADJUSTMENT"

# ---------------- Auth ----------------
async def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    if not cred:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user:
        raise HTTPException(401, "User not found")
    return clean(user)

@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email already registered")
    user = {"id": new_id(), "name": body.name.strip(), "email": email,
            "role": "customer", "password_hash": hash_pw(body.password),
            "phone": body.phone, "shop_id": None, "created_at": now_iso()}
    await db.users.insert_one(dict(user))
    await db.customers.insert_one({"id": new_id(), "name": body.name.strip(),
        "phone": body.phone or "", "email": email, "shop_id": None,
        "user_id": user["id"], "total_sessions": 0, "total_spent": 0.0,
        "last_visit": None, "created_at": now_iso()})
    pub = {k: user[k] for k in ("id", "name", "email", "role", "shop_id")}
    return {"access_token": make_token(user), "user": pub}

@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower().strip()})
    if not user or not check_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    pub = {k: user.get(k) for k in ("id", "name", "email", "role", "shop_id")}
    return {"access_token": make_token(user), "user": pub}

@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return {k: user.get(k) for k in ("id", "name", "email", "role", "shop_id")}

# ---------------- Shops ----------------
@api.get("/shops")
async def get_shops(user=Depends(current_user)):
    return [clean(s) for s in await db.shops.find().to_list(100)]

# ---------------- Stations ----------------
@api.get("/stations")
async def get_stations(shop_id: Optional[str] = None, user=Depends(current_user)):
    q = {}
    if shop_id and shop_id != "all":
        q["shop_id"] = shop_id
    stations = [clean(s) for s in await db.stations.find(q).to_list(500)]
    for st in stations:
        sess = await db.sessions.find_one({"station_id": st["id"], "status": "active"})
        st["active_session"] = clean(sess) if sess else None
        if sess:
            cust = await db.customers.find_one({"id": sess["customer_id"]})
            st["current_customer"] = cust["name"] if cust else None
            game = await db.games.find_one({"id": sess.get("game_id")}) if sess.get("game_id") else None
            st["current_game"] = game["name"] if game else None
        nb = await db.bookings.find_one({"station_id": st["id"], "status": {"$in": ["pending", "confirmed"]}})
        st["next_booking"] = clean(nb) if nb else None
    return stations

@api.post("/stations")
async def create_station(body: StationIn, user=Depends(current_user)):
    st = {"id": new_id(), **body.dict(), "active": True, "created_at": now_iso()}
    await db.stations.insert_one(dict(st))
    return clean(st)

@api.patch("/stations/{sid}")
async def update_station(sid: str, body: dict, user=Depends(current_user)):
    body.pop("id", None)
    await db.stations.update_one({"id": sid}, {"$set": body})
    return clean(await db.stations.find_one({"id": sid}))

# ---------------- Games ----------------
@api.get("/games")
async def get_games(user=Depends(current_user)):
    return [clean(g) for g in await db.games.find().to_list(500)]

@api.post("/games")
async def create_game(body: GameIn, user=Depends(current_user)):
    g = {"id": new_id(), **body.dict(), "created_at": now_iso()}
    await db.games.insert_one(dict(g))
    return clean(g)

@api.patch("/games/{gid}")
async def update_game(gid: str, body: dict, user=Depends(current_user)):
    body.pop("id", None)
    await db.games.update_one({"id": gid}, {"$set": body})
    return clean(await db.games.find_one({"id": gid}))

# ---------------- Customers ----------------
@api.get("/customers")
async def get_customers(user=Depends(current_user)):
    return [clean(c) for c in await db.customers.find().sort("name", 1).to_list(1000)]

@api.post("/customers")
async def create_customer(body: CustomerIn, user=Depends(current_user)):
    c = {"id": new_id(), **body.dict(), "shop_id": None, "user_id": None,
         "total_sessions": 0, "total_spent": 0.0, "last_visit": None, "created_at": now_iso()}
    await db.customers.insert_one(dict(c))
    return clean(c)

@api.get("/customers/{cid}")
async def get_customer(cid: str, user=Depends(current_user)):
    c = clean(await db.customers.find_one({"id": cid}))
    if not c:
        raise HTTPException(404, "Not found")
    sessions = [clean(s) for s in await db.sessions.find({"customer_id": cid}).sort("created_at", -1).to_list(100)]
    c["sessions"] = sessions
    return c

# ---------------- Products / Inventory ----------------
@api.get("/products")
async def get_products(shop_id: Optional[str] = None, user=Depends(current_user)):
    q = {}
    if shop_id and shop_id != "all":
        q["shop_id"] = shop_id
    return [clean(p) for p in await db.products.find(q).to_list(1000)]

@api.post("/products/{pid}/adjust")
async def adjust_product(pid: str, body: ProductAdjustIn, user=Depends(current_user)):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Not found")
    new_stock = p["current_stock"] + body.delta
    await db.products.update_one({"id": pid}, {"$set": {"current_stock": new_stock}})
    await db.movements.insert_one({"id": new_id(), "product_id": pid, "shop_id": p["shop_id"],
        "type": body.movement_type, "qty": body.delta, "balance": new_stock, "created_at": now_iso()})
    return clean(await db.products.find_one({"id": pid}))

@api.get("/movements")
async def get_movements(user=Depends(current_user)):
    return [clean(m) for m in await db.movements.find().sort("created_at", -1).to_list(200)]

# ---------------- Sessions ----------------
async def _consume_snacks(items, shop_id):
    total = 0.0
    detail = []
    for it in items:
        p = await db.products.find_one({"id": it.product_id, "shop_id": shop_id})
        if not p:
            continue
        line = p["selling_price"] * it.qty
        total += line
        detail.append({"product_id": p["id"], "name": p["name"], "qty": it.qty,
                       "price": p["selling_price"], "line_total": line})
        new_stock = p["current_stock"] - it.qty
        await db.products.update_one({"id": p["id"]}, {"$set": {"current_stock": new_stock}})
        await db.movements.insert_one({"id": new_id(), "product_id": p["id"], "shop_id": shop_id,
            "type": "SALE", "qty": -it.qty, "balance": new_stock, "created_at": now_iso()})
    return total, detail

@api.get("/sessions")
async def get_sessions(status: Optional[str] = None, shop_id: Optional[str] = None, user=Depends(current_user)):
    q = {}
    if status:
        q["status"] = status
    if shop_id and shop_id != "all":
        q["shop_id"] = shop_id
    sessions = [clean(s) for s in await db.sessions.find(q).sort("created_at", -1).to_list(500)]
    for s in sessions:
        cust = await db.customers.find_one({"id": s["customer_id"]})
        s["customer_name"] = cust["name"] if cust else "Guest"
        st = await db.stations.find_one({"id": s["station_id"]})
        s["station_name"] = st["name"] if st else ""
        if s.get("game_id"):
            g = await db.games.find_one({"id": s["game_id"]})
            s["game_name"] = g["name"] if g else None
    return sessions

@api.get("/sessions/{sid}")
async def get_session(sid: str, user=Depends(current_user)):
    s = clean(await db.sessions.find_one({"id": sid}))
    if not s:
        raise HTTPException(404, "Not found")
    cust = await db.customers.find_one({"id": s["customer_id"]})
    s["customer_name"] = cust["name"] if cust else "Guest"
    st = await db.stations.find_one({"id": s["station_id"]})
    s["station_name"] = st["name"] if st else ""
    s["station_type"] = st["type"] if st else ""
    if s.get("game_id"):
        g = await db.games.find_one({"id": s["game_id"]})
        s["game_name"] = g["name"] if g else None
    return s

@api.post("/sessions")
async def start_session(body: SessionStartIn, user=Depends(current_user)):
    st = await db.stations.find_one({"id": body.station_id})
    if not st:
        raise HTTPException(404, "Station not found")
    if st["status"] == "playing":
        raise HTTPException(400, "Station is already in use")
    start = datetime.now(timezone.utc)
    end = start + timedelta(minutes=body.duration_minutes)
    rate = st["hourly_rate"]
    gaming_amount = round(rate * (body.duration_minutes / 60), 2)
    sess = {"id": new_id(), "shop_id": body.shop_id, "station_id": body.station_id,
            "customer_id": body.customer_id, "game_id": body.game_id,
            "start_time": start.isoformat(), "planned_end": end.isoformat(),
            "end_time": None, "duration_minutes": body.duration_minutes,
            "rate": rate, "gaming_amount": gaming_amount, "snack_amount": 0.0,
            "snacks": [], "discount": 0.0, "total": gaming_amount,
            "payment_method": body.payment_method, "payment_status": "unpaid",
            "status": "active", "created_by": user["name"], "created_at": now_iso()}
    await db.sessions.insert_one(dict(sess))
    await db.stations.update_one({"id": body.station_id}, {"$set": {"status": "playing"}})
    return clean(sess)

@api.post("/sessions/{sid}/extend")
async def extend_session(sid: str, body: ExtendIn, user=Depends(current_user)):
    s = await db.sessions.find_one({"id": sid, "status": "active"})
    if not s:
        raise HTTPException(404, "Active session not found")
    planned = datetime.fromisoformat(s["planned_end"]) + timedelta(minutes=body.minutes)
    dur = s["duration_minutes"] + body.minutes
    gaming = round(s["rate"] * (dur / 60), 2)
    total = gaming + s["snack_amount"] - s["discount"]
    await db.sessions.update_one({"id": sid}, {"$set": {"planned_end": planned.isoformat(),
        "duration_minutes": dur, "gaming_amount": gaming, "total": total}})
    return clean(await db.sessions.find_one({"id": sid}))

@api.post("/sessions/{sid}/snacks")
async def add_snacks(sid: str, body: AddSnacksIn, user=Depends(current_user)):
    s = await db.sessions.find_one({"id": sid, "status": "active"})
    if not s:
        raise HTTPException(404, "Active session not found")
    add_total, detail = await _consume_snacks(body.items, s["shop_id"])
    snacks = s.get("snacks", []) + detail
    snack_amount = round(s["snack_amount"] + add_total, 2)
    total = round(s["gaming_amount"] + snack_amount - s["discount"], 2)
    await db.sessions.update_one({"id": sid}, {"$set": {"snacks": snacks,
        "snack_amount": snack_amount, "total": total}})
    return clean(await db.sessions.find_one({"id": sid}))

@api.post("/sessions/{sid}/change-game")
async def change_game(sid: str, body: dict, user=Depends(current_user)):
    await db.sessions.update_one({"id": sid}, {"$set": {"game_id": body.get("game_id")}})
    return clean(await db.sessions.find_one({"id": sid}))

@api.post("/sessions/{sid}/end")
async def end_session(sid: str, user=Depends(current_user)):
    s = await db.sessions.find_one({"id": sid, "status": "active"})
    if not s:
        raise HTTPException(404, "Active session not found")
    await db.sessions.update_one({"id": sid}, {"$set": {"status": "completed",
        "end_time": now_iso(), "payment_status": "paid"}})
    await db.stations.update_one({"id": s["station_id"]}, {"$set": {"status": "free"}})
    await db.customers.update_one({"id": s["customer_id"]},
        {"$inc": {"total_sessions": 1, "total_spent": s["total"]},
         "$set": {"last_visit": now_iso()}})
    return clean(await db.sessions.find_one({"id": sid}))

# ---------------- POS ----------------
@api.post("/pos/checkout")
async def pos_checkout(body: POSCheckoutIn, user=Depends(current_user)):
    if body.session_id:
        return await add_snacks(body.session_id, AddSnacksIn(items=body.items), user)
    total, detail = await _consume_snacks(body.items, body.shop_id)
    order = {"id": new_id(), "shop_id": body.shop_id, "items": detail, "total": total,
             "payment_method": body.payment_method, "customer_id": body.customer_id,
             "type": "snack", "created_by": user["name"], "created_at": now_iso()}
    await db.orders.insert_one(dict(order))
    return clean(order)

# ---------------- Bookings ----------------
def _to_minutes(t):
    h, m = t.split(":")
    return int(h) * 60 + int(m)

@api.get("/bookings")
async def get_bookings(shop_id: Optional[str] = None, date: Optional[str] = None, user=Depends(current_user)):
    q = {}
    if shop_id and shop_id != "all":
        q["shop_id"] = shop_id
    if date:
        q["date"] = date
    bks = [clean(b) for b in await db.bookings.find(q).sort("start_time", 1).to_list(500)]
    for b in bks:
        cust = await db.customers.find_one({"id": b["customer_id"]})
        b["customer_name"] = cust["name"] if cust else "Guest"
        st = await db.stations.find_one({"id": b["station_id"]})
        b["station_name"] = st["name"] if st else ""
        if b.get("game_id"):
            g = await db.games.find_one({"id": b["game_id"]})
            b["game_name"] = g["name"] if g else None
    return bks

@api.post("/bookings")
async def create_booking(body: BookingIn, user=Depends(current_user)):
    ns, ne = _to_minutes(body.start_time), _to_minutes(body.end_time)
    if ne <= ns:
        raise HTTPException(400, "End time must be after start time")
    existing = await db.bookings.find({"station_id": body.station_id, "date": body.date,
        "status": {"$in": ["pending", "confirmed", "checked_in"]}}).to_list(200)
    for b in existing:
        bs, be = _to_minutes(b["start_time"]), _to_minutes(b["end_time"])
        if ns < be and bs < ne:
            raise HTTPException(409, "Station unavailable during the selected time")
    st = await db.stations.find_one({"id": body.station_id})
    rate = st["hourly_rate"] if st else 150
    amount = round(rate * ((ne - ns) / 60), 2)
    ref = "BK-" + body.date.replace("-", "") + "-" + new_id()[:4].upper()
    bk = {"id": new_id(), "ref": ref, **body.dict(), "amount": amount,
          "payment_status": "unpaid", "status": "confirmed", "created_at": now_iso()}
    await db.bookings.insert_one(dict(bk))
    await db.stations.update_one({"id": body.station_id, "status": "free"}, {"$set": {"status": "booked"}})
    return clean(bk)

@api.post("/bookings/{bid}/checkin")
async def checkin_booking(bid: str, user=Depends(current_user)):
    b = await db.bookings.find_one({"id": bid})
    if not b:
        raise HTTPException(404, "Not found")
    dur = _to_minutes(b["end_time"]) - _to_minutes(b["start_time"])
    await db.stations.update_one({"id": b["station_id"]}, {"$set": {"status": "free"}})
    sess = await start_session(SessionStartIn(shop_id=b["shop_id"], station_id=b["station_id"],
        customer_id=b["customer_id"], game_id=b.get("game_id"), duration_minutes=dur), user)
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "checked_in", "session_id": sess["id"]}})
    return sess

@api.post("/bookings/{bid}/cancel")
async def cancel_booking(bid: str, user=Depends(current_user)):
    b = await db.bookings.find_one({"id": bid})
    if not b:
        raise HTTPException(404, "Not found")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "cancelled"}})
    await db.stations.update_one({"id": b["station_id"], "status": "booked"}, {"$set": {"status": "free"}})
    return {"ok": True}

# ---------------- Dashboard / Reports ----------------
@api.get("/dashboard")
async def dashboard(shop_id: Optional[str] = None, range: str = "today", user=Depends(current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    if range == "week":
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    elif range == "month":
        since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    else:
        since = today

    def match(doc):
        if shop_id and shop_id != "all" and doc.get("shop_id") != shop_id:
            return False
        return doc.get("created_at", "") >= since

    sessions = await db.sessions.find().to_list(5000)
    orders = await db.orders.find().to_list(5000)
    bookings = await db.bookings.find().to_list(5000)

    fsessions = [s for s in sessions if match(s)]
    gaming_rev = sum(s.get("gaming_amount", 0) for s in fsessions if s["status"] == "completed")
    snack_rev = sum(s.get("snack_amount", 0) for s in fsessions if s["status"] == "completed")
    snack_rev += sum(o.get("total", 0) for o in orders if match(o))
    active = [s for s in sessions if s["status"] == "active" and (not shop_id or shop_id == "all" or s["shop_id"] == shop_id)]
    fbookings = [b for b in bookings if (not shop_id or shop_id == "all" or b.get("shop_id") == shop_id)]

    stq = {} if (not shop_id or shop_id == "all") else {"shop_id": shop_id}
    stations = await db.stations.find(stq).to_list(500)
    total_stations = len(stations)
    playing = len([s for s in stations if s["status"] == "playing"])
    free = len([s for s in stations if s["status"] == "free"])
    occupancy = round((playing / total_stations) * 100) if total_stations else 0

    products = await db.products.find(stq).to_list(1000)
    low_stock = len([p for p in products if p["current_stock"] <= p.get("minimum_stock", 0)])

    return {
        "total_revenue": round(gaming_rev + snack_rev, 2),
        "gaming_revenue": round(gaming_rev, 2),
        "snack_revenue": round(snack_rev, 2),
        "active_sessions": len(active),
        "today_sessions": len(fsessions),
        "today_bookings": len([b for b in fbookings if b.get("date") == today]),
        "available_stations": free,
        "total_stations": total_stations,
        "occupancy": occupancy,
        "low_stock_items": low_stock,
    }

@api.get("/dashboard/shops")
async def dashboard_shops(user=Depends(current_user)):
    out = []
    shops = await db.shops.find().to_list(100)
    for sh in shops:
        d = await dashboard(shop_id=sh["id"], range="today", user=user)
        out.append({"shop_id": sh["id"], "name": sh["name"], "code": sh.get("code"),
                    "revenue": d["total_revenue"], "sessions": d["today_sessions"],
                    "active_players": d["active_sessions"], "occupancy": d["occupancy"]})
    return out

@api.get("/reports")
async def reports(shop_id: Optional[str] = None, range: str = "today", user=Depends(current_user)):
    d = await dashboard(shop_id=shop_id, range=range, user=user)
    sessions = await db.sessions.find({"status": "completed"}).to_list(5000)
    if shop_id and shop_id != "all":
        sessions = [s for s in sessions if s["shop_id"] == shop_id]
    game_count = {}
    for s in sessions:
        if s.get("game_id"):
            g = await db.games.find_one({"id": s["game_id"]})
            if g:
                game_count[g["name"]] = game_count.get(g["name"], 0) + 1
    top_games = sorted([{"name": k, "count": v} for k, v in game_count.items()],
                       key=lambda x: -x["count"])[:8]
    cash = sum(s.get("total", 0) for s in sessions if s.get("payment_method") == "cash")
    upi = sum(s.get("total", 0) for s in sessions if s.get("payment_method") in ("upi", "card"))
    return {**d, "top_games": top_games, "cash_total": round(cash, 2), "upi_total": round(upi, 2)}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ---------------- Seed ----------------
@app.on_event("startup")
async def seed():
    if await db.shops.count_documents({}) > 0:
        return
    logger.info("Seeding NexusArena data...")
    shop1 = {"id": new_id(), "name": "Cyber Arena - Indiranagar", "code": "Shop 1", "city": "Bengaluru"}
    shop2 = {"id": new_id(), "name": "Neon Zone - Koramangala", "code": "Shop 2", "city": "Bengaluru"}
    await db.shops.insert_many([dict(shop1), dict(shop2)])

    demo_users = [
        ("Rohan Owner", "owner@nexus.com", "Owner@123", "owner", None),
        ("Meera Manager", "manager@nexus.com", "Manager@123", "manager", shop1["id"]),
        ("Sam Staff", "staff@nexus.com", "Staff@123", "staff", shop1["id"]),
        ("Aditi Gamer", "customer@nexus.com", "Customer@123", "customer", None),
    ]
    for name, email, pw, role, sid in demo_users:
        await db.users.insert_one({"id": new_id(), "name": name, "email": email,
            "role": role, "password_hash": hash_pw(pw), "phone": None,
            "shop_id": sid, "created_at": now_iso()})

    games = [("EA FC 26", "PlayStation", "Sports"), ("GTA V", "Both", "Action"),
             ("Tekken 8", "PlayStation", "Fighting"), ("WWE 2K26", "PlayStation", "Sports"),
             ("Forza Horizon", "Both", "Racing"), ("Valorant", "Gaming PC", "FPS"),
             ("Counter-Strike 2", "Gaming PC", "FPS"), ("GTA VI", "PlayStation", "Action")]
    for gn, gp, gg in games:
        await db.games.insert_one({"id": new_id(), "name": gn, "platform": gp, "genre": gg,
            "active": True, "created_at": now_iso()})

    for sh in (shop1, shop2):
        for i in range(1, 5):
            await db.stations.insert_one({"id": new_id(), "shop_id": sh["id"],
                "name": f"PS5-0{i}", "type": "PS5", "hourly_rate": 150,
                "description": "PS5 Disc + DualSense", "status": "free", "active": True,
                "created_at": now_iso()})
        for i in range(1, 4):
            await db.stations.insert_one({"id": new_id(), "shop_id": sh["id"],
                "name": f"PC-0{i}", "type": "Gaming PC", "hourly_rate": 120,
                "description": "RTX 4080 / 240Hz", "status": "free", "active": True,
                "created_at": now_iso()})

    prods = [("Coke 500ml", "Cold Drinks", 25, 40, 38), ("Pepsi 500ml", "Cold Drinks", 25, 40, 30),
             ("Sprite", "Cold Drinks", 25, 40, 20), ("Red Bull", "Energy Drinks", 90, 130, 15),
             ("Water 1L", "Water", 10, 20, 60), ("Lays", "Chips", 12, 20, 45),
             ("Dairy Milk", "Chocolate", 25, 40, 25), ("Kurkure", "Chips", 12, 20, 8),
             ("Maggi Cup", "Snacks", 30, 50, 12), ("Oreo", "Biscuits", 20, 30, 18)]
    for sh in (shop1, shop2):
        for n, cat, pp, sp, stock in prods:
            await db.products.insert_one({"id": new_id(), "name": n, "category": cat,
                "sku": n[:3].upper() + str(sp), "purchase_price": pp, "selling_price": sp,
                "current_stock": stock, "minimum_stock": 10, "unit": "pcs",
                "shop_id": sh["id"], "active": True, "created_at": now_iso()})

    customers = [("Rahul Sharma", "9876543210"), ("Amit Verma", "9811122233"),
                 ("Priya Nair", "9900011122"), ("Karan Singh", "9822233344")]
    for cn, cp in customers:
        await db.customers.insert_one({"id": new_id(), "name": cn, "phone": cp,
            "email": None, "shop_id": None, "user_id": None, "total_sessions": 0,
            "total_spent": 0.0, "last_visit": None, "created_at": now_iso()})
    logger.info("Seed complete.")

@app.on_event("shutdown")
async def shutdown_db():
    client.close()
