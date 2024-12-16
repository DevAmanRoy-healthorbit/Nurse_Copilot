from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from pydantic import BaseModel, Field
from typing import List, Union
import openai
import re
import json
from datetime import datetime
from dotenv import load_dotenv
import os
app = FastAPI()
load_dotenv() 

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set your OpenAI API key
openai.api_key = ""  # Replace with your actual OpenAI API key
# openai_api_key = os.getenv('OPENAI_API_KEY') 
# print("OpenAI API Key:", openai_api_key)  # Debugging line

# Database connection
def create_connection():
    try:
        return mysql.connector.connect(
            host='54.214.125.176',
            user='healthorbit_stage',
            password='wwe_%6JAqswd',
            database='health_orbit'
        )
    except mysql.connector.Error as err:
        print(f"Database Connection Error: {err}")
        raise

# Data models for request payload
class MessageContent(BaseModel):
    type: str
    text: Union[str, None] = None
    transcript: Union[str, None] = None

class MessageItem(BaseModel):
    role: str
    message: List[MessageContent]

class ConversationPayload(BaseModel):
    formatted: List[MessageItem]

def extract_patient_details_with_openai(full_transcript):
    """
    Use OpenAI API to extract patient details from the full conversation transcript
    """
    try:
        # Prepare the prompt for OpenAI
        prompt = f"""
        Extract structured patient details from the following conversation transcript:
        
        Transcript: {full_transcript}
        
        Please provide the details in a strict JSON format. If any detail is not present, 
        use null for that field. Include these fields:
        - name (string or null)
        - age (integer or null)
        - height (string or null)
        - weight (string or null)
        - blood (string or null)
        - gender (string or null)
        - symptoms (string or null)

        Response format:
        {{
            "name": "Patient Name",
            "age": 30,
            "height": "180 cm",
            "weight": "70 kg",
            "blood": "O+",
            "gender": "Male",
            "symptoms": "Headache, fever"
        }}
        """

        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo-0125",
            messages=[
                {"role": "system", "content": "You are a helpful medical assistant extracting patient details from a conversation."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            max_tokens=300
        )

        # Extract and parse the JSON response
        patient_details_str = response.choices[0].message.content.strip()
        patient_details = json.loads(patient_details_str)

        print("OpenAI Extracted Patient Details:", patient_details)
        return patient_details

    except Exception as e:
        print(f"OpenAI API Error: {e}")
        # Return default details if extraction fails
        return {
            "name": "Unknown Patient",
            "age": None,
            "height": None,
            "weight": None,
            "blood": None,
            "gender": None,
            "symptoms": "No symptoms reported"
        }

@app.post("/save-conversation")
async def save_conversation(payload: ConversationPayload):
    try:
        # Combine all transcripts for conversation record
        full_transcript = " ".join([
            content.transcript or content.text or ""
            for message in payload.formatted
            for content in message.message
            if content.transcript or content.text
        ])

        print("Full Conversation Transcript:", full_transcript)

        # Extract patient details using OpenAI
        patient_details = extract_patient_details_with_openai(full_transcript)

        # Prepare the database connection
        conn = create_connection()
        cursor = conn.cursor()

        # Generate a timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Insert the full transcript into the `conversation` table
        conversation_query = """
        INSERT INTO copilot_conversation (user_message, timestamp) 
        VALUES (%s, %s)
        """
        cursor.execute(conversation_query, (full_transcript, timestamp))
        conversation_id = cursor.lastrowid

        # Insert patient details into the `patient` table
        patient_query = """
        INSERT INTO patient (
            conversation_id, name, age, height, weight, 
            blood, gender, symptoms, timestamp
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(
            patient_query,
            (
                conversation_id,
                patient_details.get("name", "Unknown Patient"),
                patient_details.get("age"),
                patient_details.get("height"),
                patient_details.get("weight"),
                patient_details.get("blood"),
                patient_details.get("gender"),
                patient_details.get("symptoms", "No symptoms reported"),
                timestamp
            )
        )

        # Commit the transaction
        conn.commit()

        # Close the database connection
        cursor.close()
        conn.close()

        return {
            "message": "Conversation and patient details saved successfully.",
            "conversation_id": conversation_id,
            "patient_details": patient_details
        }

    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(err)}")
    except Exception as err:
        print(f"Unexpected error: {err}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(err)}")

@app.get("/")
async def root():
    return {"message": "Nurse Copilot Backend is running"}