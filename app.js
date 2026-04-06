require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple AI logic to assign doctor/department/urgency
function agenticAI(symptoms) {
  let doctor = "General Physician";
  let department = "General";
  let urgency = "Low";

  const s = symptoms.toLowerCase();
  if (s.includes("heart") || s.includes("chest pain")) {
    doctor = "Dr. Cardio";
    department = "Cardiology";
    urgency = "High";
  } else if (s.includes("fever") || s.includes("cough")) {
    doctor = "Dr. Internal";
    department = "Internal Medicine";
    urgency = "Medium";
  }

  return { doctor, department, urgency };
}

// POST route to submit appointment
app.post('/submit', async (req, res) => {
  try {
    const { name, age, symptoms, reason, date, time } = req.body;

    if (!name || !age || !symptoms || !date || !time) {
      return res.status(400).send("Please fill all required fields.");
    }

    // AI result
    const aiResult = agenticAI(symptoms);

    // 🔐 REAL Auth0 Token (axios call)
    const tokenResponse = await axios.post(
      `${process.env.AUTH0_ISSUER}/oauth/token`,
      {
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: "https://hospital-api",
        grant_type: "client_credentials"
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const accessToken = tokenResponse.data.access_token;

    console.log("[TokenVault] Token generated:", accessToken);

    // Save patient
    const patientsFile = path.join(__dirname, 'patients.json');
    let patients = [];

    if (fs.existsSync(patientsFile)) {
      patients = JSON.parse(fs.readFileSync(patientsFile, 'utf8'));
    }

    const newPatient = {
      name,
      age,
      symptoms,
      department: aiResult.department,
      doctor: aiResult.doctor,
      urgency: aiResult.urgency,
      reason,
      date,
      time,
      token: accessToken  // store token for reference
    };

    patients.push(newPatient);
    fs.writeFileSync(patientsFile, JSON.stringify(patients, null, 2));

    // Send confirmation with token details
    res.send(`
      <h3>Appointment Confirmed!</h3>
      <p>Name: ${name}</p>
      <p>Age: ${age}</p>
      <p>Symptoms: ${symptoms}</p>
      <p>Department: ${aiResult.department}</p>
      <p>Doctor: ${aiResult.doctor}</p>
      <p>Urgency: ${aiResult.urgency}</p>
      <p>Date: ${date}</p>
      <p>Time: ${time}</p>
      <p><strong>Security:</strong> Token Vault (scope: hospital:appointment:create)</p>
      <p><strong>🔐 Token Vault Token (truncated):</strong> ${accessToken.slice(0,30)}...</p>
      <a href="/">Book Another</a><br>
      <a href="/patients">View Patients</a>
    `);
  } catch (error) {
    console.error("Auth0 Error:", error.response?.data || error.message);
    res.status(500).send("Auth0 Token Error");
  }
});

// View patients table
app.get('/patients', (req, res) => {
  const patientsFile = path.join(__dirname, 'patients.json');

  if (!fs.existsSync(patientsFile)) {
    return res.send("No records found");
  }

  const patients = JSON.parse(fs.readFileSync(patientsFile, 'utf8'));

  // Table headers with Age included
  let html = `
    <h2>Patients</h2>
    <table border='1' cellpadding='5' cellspacing='0'>
      <tr>
        <th>Name</th>
        <th>Age</th>
        <th>Dept</th>
        <th>Doctor</th>
        <th>Urgency</th>
      </tr>
  `;

  // Table rows
  patients.forEach(p => {
    html += `<tr>
      <td>${p.name}</td>
      <td style="color: ${p.age >= 60 ? 'red' : 'black'}">${p.age}</td>
      <td>${p.department}</td>
      <td>${p.doctor}</td>
      <td>${p.urgency}</td>
    </tr>`;
  });

  html += `</table><br><a href='/'>Back</a>`;

  res.send(html);
});

app.listen(PORT, () => console.log(`Server running on ${process.env.BASE_URL || 'http://localhost:'+PORT}`));