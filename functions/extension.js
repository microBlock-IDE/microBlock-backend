const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const config = require('./config.json');

const extensionIndexRepo = "microBlock-IDE/microBlock-extension-index";

const app = express();

// Automatically allow cross-origin requests
app.use(cors({ origin: true }));

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// Add extension to GitHub repo 
app.post('/', async (req, res) => {
    let gitHubURL = req.body.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+/);
    if (gitHubURL == null) {
        res.status(500).json({ 
            error: true,
            message: "GitHub url not match"
        });
        return;
    }
    gitHubURL = gitHubURL[0];

    let extensionIndexFromAPI = await fetch(`https://api.github.com/repos/${extensionIndexRepo}/contents/main.json`, { 
        redirect: "follow",
        headers: { 
            "Accept": "application/vnd.github.v3+json"
        }
    });
    if (!extensionIndexFromAPI.ok) {
        res.status(501).json({ 
            error: true,
            message: "Load extension index fail"
        });
        return false;
    }
    extensionIndexFromAPI = await extensionIndexFromAPI.json();
    let extensionIndexSHA = extensionIndexFromAPI.sha;
    extensionIndexFromAPI = extensionIndexFromAPI.content;
    extensionIndexFromAPI = Buffer.from(extensionIndexFromAPI, "base64").toString("utf-8");
    extensionIndexFromAPI = JSON.parse(extensionIndexFromAPI);
    let extensionIndex = extensionIndexFromAPI;

    let gitHubUserRepo = gitHubURL.match(/\/([^\/]+\/[^\/]+)$/)[1];
    let extensionId = gitHubUserRepo.replace("/", "_"); // "/" to "_"

    let extensionInfo = await fetch(`https://api.github.com/repos/${gitHubUserRepo}/contents/extension.js`, { 
        redirect: "follow",
        headers: { 
            "Accept": "application/vnd.github.v3.raw"
        }
    });
    if (!extensionInfo.ok) {
        res.status(501).json({ 
            error: true,
            message: "extension.js load fail"
        });
        return false;
    }
    extensionInfo = await extensionInfo.text();
    try {
        extensionInfo = eval(extensionInfo);
    } catch (e) {
        res.status(502).json({ 
            error: true,
            message: "extension.js error, " + e.toString()
        });
        return false;
    }

    // Check extension info
    let checkInfo = (info => {
        if (typeof info === "undefined") {
            return false
        }

        if (typeof info["name"] !== "string") {
            return false;
        }

        if (typeof info["category"] !== "string") {
            return false;
        }

        if (typeof info["icon"] !== "string") {
            return false;
        }

        if (typeof info["color"] !== "string") {
            return false;
        }

        if (typeof info["version"] !== "string") {
            return false;
        }

        if (typeof info["author"] !== "string") {
            return false;
        }

        if (typeof info["description"] !== "string") {
            return false;
        }

        if (typeof info["blocks"] !== "object") {
            return false;
        }

        return true;
    })(extensionInfo);

    if (!checkInfo) {
        res.status(503).json({ 
            error: true,
            message: "extension.js miss some object"
        });
        return false;
    }

    delete extensionInfo["blocks"];
    extensionInfo.github = gitHubURL;

    extensionIndex[extensionId] = extensionInfo;

    let fileContent = JSON.stringify(extensionIndex, null, 2);

    let putBody = JSON.stringify({
        message: "add " + extensionInfo.name + " extension",
        committer: {
            name: "microBlock Backend",
            email: "noreplay@microblock.app"
        },
        content: Buffer.from(fileContent).toString('base64'),
        sha: extensionIndexSHA
    });

    let extensionIndexUpdateViaAPI = await fetch(`https://api.github.com/repos/${extensionIndexRepo}/contents/main.json`, { 
        method: "put",
        body: putBody,
        redirect: "follow",
        headers: { 
            "Authorization": "token " + config.extension.github_auth
        }
    });

    if (extensionIndexUpdateViaAPI.status !== 200 && extensionIndexUpdateViaAPI.status !== 201) {
        res.status(504).json({ 
            error: true,
            message: "GitHub API error: " + (await extensionIndexUpdateViaAPI.text())
        });
        return false;
    }

    res.status(200).json({ 
        error: false,
        message: "Add extension successful",
        extension: extensionInfo
    });
});

module.exports = functions.https.onRequest(app);
