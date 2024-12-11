import { RealtimeRelay } from './lib/relay.js';
import dotenv from 'dotenv';

import * as  mysql from 'mysql2';
import  * as bodyParser from 'body-parser';
import * as cors from 'cors';
dotenv.config({ override: true });


const db = mysql.createConnection({
  host: 'localhost', // Database host
  user: 'root',      // Your MySQL username
  password: '',      // Your MySQL password
  database: 'nurse_copilot' // Your database name

});

db.connect((error)=>{
  if(error){
    console.log(error,"Unable to connect to db");
  }else{
    console.log("Database Connectd successfully")
  }
})



const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error(
    `Environment variable "OPENAI_API_KEY" is required.\n` +
      `Please set it in your .env file.`
  );
  process.exit(1);
}

const PORT = parseInt(process.env.PORT) || 8081;

const relay = new RealtimeRelay(OPENAI_API_KEY);
relay.listen(PORT);
