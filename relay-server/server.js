import express, { json } from 'express';
import { createConnection } from 'mysql2';
import cors from 'cors';

const app = express();
app.use(json(), cors());

// Database connection
const db = createConnection({
    host: 'localhost',
    user: 'root',       // Replace with your MySQL username
    password: '', // Replace with your MySQL password
    database: 'nurse_copilot'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Database connected.');
});

// API to save conversation
app.post('/save-conversation', cors(), (req, res) => {
    const data = {"user_message":req.body}
    console.log(data);

const query = "INSERT INTO conversation (user_message) VALUES (?)";

// Use parameterized query to safely insert data
db.query(query, JSON.stringify(data), (err, result) => {
    if (err) {
        console.error(err);
        res.status(500).send({ error: 'Failed to save conversation.' });
    } else {
        res.status(200).send({ message: 'Conversation saved.', id: result.insertId });
    }
});
   
    // const { userMessage, assistantResponse } = req.body;
    // db.query(query, [userMessage, assistantResponse], (err, result) => {
    //     if (err) {
    //         console.error(err);
    //         res.status(500).send({ error: 'Failed to save conversation.' });
    //     } else {
    //         res.status(200).send({ message: 'Conversation saved.', id: result.insertId });
    //     }
    // });
});

// Start server
app.listen(3001, () => {
    console.log('API running on http://localhost:3001');
});