const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const config = require('./config.json');

const app = express();

// Automatically allow cross-origin requests
app.use(cors({ origin: true }));

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// Get access token from code
app.post('/get_token', async (req, res) => {
    let access_token = await fetch("https://github.com/login/oauth/access_token", { 
        method: "post",
        body: JSON.stringify({
            client_id: config.github_app.client_id,
            client_secret: config.github_app.client_secret,
            code: req.body
        }),
        redirect: "follow",
        headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    });

    if (access_token.status !== 200) {
        res.status(500).send("GitHub API error: " + (await access_token.text()));
        return false;
    }

    access_token = await access_token.json();
    if (access_token["error"]) {
        res.status(501).send(access_token["error"] + ": " + access_token["error_description"]);
        return false;
    }
    console.log(access_token);
    res.status(200).send(access_token["access_token"]);
});

module.exports = functions.https.onRequest(app);
