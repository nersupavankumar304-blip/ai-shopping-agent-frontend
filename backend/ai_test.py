import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY environment variable is missing.")
    exit(1)

client = genai.Client(api_key=api_key)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Say hello to my AI Shopping Agent in one sentence."
)

print("AI Output:", response.text)