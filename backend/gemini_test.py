import os
from google import genai

api_key = os.environ.get("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Say hello to my AI Shopping Agent in one sentence."
)

print(response.text)