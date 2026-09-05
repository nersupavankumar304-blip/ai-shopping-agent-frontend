import os
import json
import hmac
import hashlib
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_DIR / ".env")


# ============================================================
# RAZORPAY TEST MODE CREDENTIALS
# ============================================================
# PUT YOUR REAL RAZORPAY TEST KEYS HERE.
#
# Key ID must start with:
# rzp_test_
#
# NEVER SHARE YOUR SECRET KEY.
# ============================================================

RAZORPAY_KEY_ID = "rzp_test_TXuQV7BEomd0h6"
RAZORPAY_KEY_SECRET = "XGGrnZilUREgG0bi0fyGUOHc"


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="AI Shopping Agent API",
    description="Backend for AI Shopping Agent",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

DATA_DIR = PROJECT_DIR / "data"
PRODUCT_FILE = DATA_DIR / "products.json"


# ============================================================
# LOAD PRODUCTS
# ============================================================

def load_products():
    possible_files = [
        PRODUCT_FILE,
        BASE_DIR / "data" / "products.json",
        PROJECT_DIR / "products.json",
    ]

    for file_path in possible_files:

        if file_path.exists():

            try:

                with open(
                    file_path,
                    "r",
                    encoding="utf-8"
                ) as file:

                    data = json.load(file)

                if isinstance(data, list):
                    return data

                if isinstance(data, dict):

                    if (
                        "products" in data
                        and isinstance(data["products"], list)
                    ):
                        return data["products"]

            except Exception as error:

                print(
                    "Product loading error:",
                    error
                )

    print("WARNING: products.json not found.")

    return []


products = load_products()


# ============================================================
# OPTIONAL GEMINI (Supports google-genai and google-generativeai)
# ============================================================

gemini_client = None
gemini_legacy_model = None

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("Gemini GenAI client initialized successfully.")
    except Exception as error:
        print("Google GenAI SDK import/init error:", error)
        try:
            import google.generativeai as legacy_genai
            legacy_genai.configure(api_key=GEMINI_API_KEY)
            gemini_legacy_model = legacy_genai.GenerativeModel("gemini-1.5-flash")
            print("Legacy Gemini client initialized successfully.")
        except Exception as legacy_err:
            print("Legacy Gemini init error:", legacy_err)
else:
    print("GEMINI_API_KEY environment variable not found.")


# ============================================================
# RAZORPAY
# ============================================================

razorpay_client = None

try:

    import razorpay

    # Clean accidental spaces
    RAZORPAY_KEY_ID = (
        RAZORPAY_KEY_ID.strip()
        if RAZORPAY_KEY_ID
        else ""
    )

    RAZORPAY_KEY_SECRET = (
        RAZORPAY_KEY_SECRET.strip()
        if RAZORPAY_KEY_SECRET
        else ""
    )

    if (
        RAZORPAY_KEY_ID
        and RAZORPAY_KEY_SECRET
        and not RAZORPAY_KEY_ID.startswith("PASTE_")
        and not RAZORPAY_KEY_SECRET.startswith("PASTE_")
    ):

        razorpay_client = razorpay.Client(
            auth=(
                RAZORPAY_KEY_ID,
                RAZORPAY_KEY_SECRET
            )
        )

        print(
            "Razorpay client initialized successfully."
        )

    else:

        print(
            "Razorpay credentials not configured."
        )

except Exception as error:

    print(
        "Razorpay initialization error:",
        error
    )


# ============================================================
# BASIC ROUTES
# ============================================================

@app.get("/")
def home():

    return {
        "status": "success",
        "message": "AI Shopping Agent Backend is running",
        "products_loaded": len(products),
        "gemini_available": (gemini_client is not None or gemini_legacy_model is not None),
        "razorpay_available": razorpay_client is not None
    }


@app.get("/health")
def health():

    return {
        "status": "ok"
    }


# ============================================================
# PRODUCTS
# ============================================================

@app.get("/products")
def get_products():

    return {
        "products": products
    }


@app.get("/products/{product_id}")
def get_product(product_id: str):

    for product in products:

        current_id = str(
            product.get("id", "")
        )

        if current_id == str(product_id):

            return product

    raise HTTPException(
        status_code=404,
        detail="Product not found"
    )


# ============================================================
# SEARCH HELPERS
# ============================================================

def normalize_product(product):

    return {
        "id": product.get("id", ""),
        "name": product.get(
            "name",
            "Unknown Product"
        ),
        "category": product.get(
            "category",
            "Other"
        ),
        "price": product.get(
            "price",
            0
        ),
        "description": product.get(
            "description",
            ""
        ),
        "features": product.get(
            "features",
            []
        ),
        "image": product.get(
            "image",
            product.get(
                "image_url",
                ""
            )
        ),
        "rating": product.get(
            "rating",
            0
        ),
        "discount": product.get(
            "discount",
            0
        ),
        "stock": product.get(
            "stock",
            True
        )
    }


def search_local_products(query: str):

    query_words = [
        word.lower()
        for word in query.split()
        if len(word) > 1
    ]

    results = []

    for product in products:

        name = str(
            product.get(
                "name",
                ""
            )
        ).lower()

        category = str(
            product.get(
                "category",
                ""
            )
        ).lower()

        description = str(
            product.get(
                "description",
                ""
            )
        ).lower()

        features = product.get(
            "features",
            []
        )

        if isinstance(features, list):

            features_text = " ".join(
                str(item).lower()
                for item in features
            )

        else:

            features_text = str(
                features
            ).lower()

        searchable_text = (
            name
            + " "
            + category
            + " "
            + description
            + " "
            + features_text
        )

        score = 0

        for word in query_words:

            if word in name:
                score += 5

            if word in category:
                score += 4

            if word in description:
                score += 2

            if word in features_text:
                score += 2

        if score > 0:

            results.append(
                (
                    score,
                    product
                )
            )

    results.sort(
        key=lambda item: item[0],
        reverse=True
    )

    return [
        normalize_product(product)
        for score, product in results[:10]
    ]


# ============================================================
# AI SEARCH
# ============================================================

@app.get("/ai-search")
def ai_search(
    query: str = Query(
        ...,
        min_length=1
    )
):

    query = query.strip()

    if not query:

        raise HTTPException(
            status_code=400,
            detail="Search query cannot be empty"
        )

    # --------------------------------------------------------
    # LOCAL PRODUCT SEARCH
    # --------------------------------------------------------

    matched_products = search_local_products(
        query
    )

    # --------------------------------------------------------
    # GEMINI ANSWER
    # --------------------------------------------------------

    answer = ""

    prompt = f"""
You are an AI shopping assistant.

User search:
{query}

Available matching products:
{json.dumps(matched_products[:6], ensure_ascii=False)}

Give a short and useful shopping recommendation.

Mention:
1. What type of product the user should consider.
2. The best matching products.
3. Why they match.
4. Keep the answer simple and concise.

Do not invent product prices or specifications.
"""

    if gemini_client is not None:
        try:
            response = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            answer = getattr(response, "text", "") or ""
        except Exception as error:
            print("Gemini search error (GenAI SDK):", error)

    if not answer and gemini_legacy_model is not None:
        try:
            response = gemini_legacy_model.generate_content(prompt)
            answer = getattr(response, "text", "") or ""
        except Exception as error:
            print("Gemini search error (Legacy SDK):", error)

    # --------------------------------------------------------
    # FALLBACK ANSWER
    # --------------------------------------------------------

    if not answer:

        if matched_products:

            first = matched_products[0]

            answer = (
                f"I found "
                f"{len(matched_products)} "
                f"product"
                f"{'s' if len(matched_products) != 1 else ''} "
                f"matching '{query}'. "
                f"My top recommendation is "
                f"{first['name']}."
            )

        else:

            answer = (
                f"I couldn't find an exact match "
                f"for '{query}'. "
                f"Try a broader product name such as "
                f"headphones, mouse, keyboard, or speaker."
            )

    return {
        "answer": answer,
        "products": matched_products
    }


# ============================================================
# PAYMENT MODELS
# ============================================================

class CreateOrderRequest(BaseModel):

    amount: float

    currency: str = "INR"

    receipt: Optional[str] = None


class VerifyPaymentRequest(BaseModel):

    razorpay_order_id: str

    razorpay_payment_id: str

    razorpay_signature: str


# ============================================================
# RAZORPAY CREATE ORDER
# ============================================================

@app.post("/create-order")
def create_order(
    data: CreateOrderRequest
):

    # --------------------------------------------------------
    # VALIDATE AMOUNT
    # --------------------------------------------------------

    try:

        amount_paise = int(
            round(
                float(data.amount) * 100
            )
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid amount"
        )

    if amount_paise <= 0:

        raise HTTPException(
            status_code=400,
            detail="Amount must be greater than zero"
        )

    # --------------------------------------------------------
    # CHECK RAZORPAY
    # --------------------------------------------------------

    if razorpay_client is None:

        raise HTTPException(
            status_code=500,
            detail=(
                "Razorpay is not configured. "
                "Check your TEST Key ID and Secret."
            )
        )

    # --------------------------------------------------------
    # CREATE UNIQUE RECEIPT
    # --------------------------------------------------------

    receipt = data.receipt

    if not receipt:

        receipt = (
            "shopping_"
            + str(time.time_ns())
        )

    # Razorpay receipt should be short
    receipt = receipt[:40]

    # --------------------------------------------------------
    # CREATE RAZORPAY ORDER
    # --------------------------------------------------------

    order_data = {
        "amount": amount_paise,
        "currency": data.currency.upper(),
        "receipt": receipt
    }

    print("")
    print("==============================================")
    print("CREATING RAZORPAY TEST ORDER")
    print("==============================================")
    print(
        "Amount:",
        amount_paise
    )
    print(
        "Currency:",
        data.currency.upper()
    )
    print(
        "Key ID:",
        RAZORPAY_KEY_ID[:12]
        + "..."
        if RAZORPAY_KEY_ID
        else "MISSING"
    )
    print(
        "Secret configured:",
        bool(RAZORPAY_KEY_SECRET)
    )
    print("==============================================")

    try:

        order = razorpay_client.order.create(
            data=order_data
        )

        print(
            "Razorpay order created successfully:"
        )

        print(
            order.get(
                "id",
                "NO_ORDER_ID"
            )
        )

        return {
            "success": True,
            "order": order,
            "key_id": RAZORPAY_KEY_ID
        }

    except Exception as error:

        error_text = str(error)

        print("")
        print(
            "=============================================="
        )
        print(
            "RAZORPAY ORDER ERROR"
        )
        print(
            "=============================================="
        )
        print(
            "Error:",
            error_text
        )
        print(
            "=============================================="
        )

        # Authentication problem
        if (
            "Authentication failed"
            in error_text
            or "authentication" in error_text.lower()
            or "unauthorized" in error_text.lower()
        ):

            raise HTTPException(
                status_code=401,
                detail=(
                    "Razorpay authentication failed. "
                    "Your TEST Key ID and TEST Secret "
                    "do not match. Generate a fresh TEST "
                    "key pair and paste BOTH values."
                )
            )

        raise HTTPException(
            status_code=500,
            detail=(
                "Razorpay order creation failed: "
                + error_text
            )
        )


# ============================================================
# RAZORPAY PUBLIC KEY
# ============================================================

@app.get("/razorpay-key")
def get_razorpay_key():

    if not RAZORPAY_KEY_ID:

        raise HTTPException(
            status_code=500,
            detail="Razorpay Key ID is not configured"
        )

    return {
        "success": True,
        "key_id": RAZORPAY_KEY_ID
    }


# ============================================================
# RAZORPAY PAYMENT VERIFICATION
# ============================================================

@app.post("/verify-payment")
def verify_payment(
    data: VerifyPaymentRequest
):

    key_secret = RAZORPAY_KEY_SECRET

    if (
        not key_secret
        or key_secret.startswith("PASTE_")
    ):

        raise HTTPException(
            status_code=500,
            detail="Razorpay secret is not configured"
        )

    # --------------------------------------------------------
    # CREATE SIGNATURE
    # --------------------------------------------------------

    message = (
        data.razorpay_order_id
        + "|"
        + data.razorpay_payment_id
    )

    generated_signature = hmac.new(
        key_secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    # --------------------------------------------------------
    # VERIFY
    # --------------------------------------------------------

    if hmac.compare_digest(
        generated_signature,
        data.razorpay_signature
    ):

        return {
            "success": True,
            "verified": True,
            "message": "Payment verified successfully"
        }

    raise HTTPException(
        status_code=400,
        detail="Payment verification failed"
    )


# ============================================================
# ORDER CONFIRMATION
# ============================================================

class OrderRequest(BaseModel):

    name: str

    mobile: str

    address: str

    payment_method: str

    amount: float

    items: list = []


@app.post("/place-order")
def place_order(
    data: OrderRequest
):

    if not data.name.strip():

        raise HTTPException(
            status_code=400,
            detail="Name is required"
        )

    if not data.mobile.strip():

        raise HTTPException(
            status_code=400,
            detail="Mobile number is required"
        )

    if not data.address.strip():

        raise HTTPException(
            status_code=400,
            detail="Delivery address is required"
        )

    order_id = (
        "ORDER-"
        + hashlib.sha256(
            (
                data.name
                + data.mobile
                + data.address
            ).encode()
        ).hexdigest()[:10].upper()
    )

    return {
        "success": True,
        "order_id": order_id,
        "message": "Order placed successfully",
        "customer": {
            "name": data.name,
            "mobile": data.mobile,
            "address": data.address
        },
        "payment_method": data.payment_method,
        "amount": data.amount,
        "items": data.items
    }


# ============================================================
# USER PROFILE
# ============================================================

class ProfileRequest(BaseModel):

    name: str

    email: str

    mobile: Optional[str] = ""

    address: Optional[str] = ""


@app.post("/profile")
def save_profile(
    data: ProfileRequest
):

    return {
        "success": True,
        "profile": data.model_dump()
    }


# ============================================================
# STARTUP INFORMATION
# ============================================================

print("")
print("==============================================")
print("       AI SHOPPING AGENT BACKEND")
print("==============================================")
print(
    f"Products loaded: {len(products)}"
)
print(
    f"Gemini available: {gemini_client is not None or gemini_legacy_model is not None}"
)
print(
    f"Razorpay available: {razorpay_client is not None}"
)
print(
    f"Razorpay TEST Key: "
    f"{RAZORPAY_KEY_ID[:12]}..."
    if RAZORPAY_KEY_ID
    else "Razorpay TEST Key: MISSING"
)
print("==============================================")
print("")