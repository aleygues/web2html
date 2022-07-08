import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";

const TIMEOUT = process.env.TIMEOUT ? Number(process.env.TIMEOUT) : 10;

const app = express();

app.use(express.json());
app.use(cors());

let browser: puppeteer.Browser;

async function getBrowser(): Promise<puppeteer.Browser> {
    if (!browser || browser.isConnected() === false) {
        browser = await puppeteer.launch({
            executablePath: "/usr/bin/google-chrome",
            args: ["--no-sandbox"], // if we need them.
        });
    }
    return browser;
}

app.post("/html", async (req, res) => {
    if (!req.body.url) {
        return res.status(400).json({
            message: "missing_url",
        });
    }

    if (!req.body.htmlSelector) {
        return res.status(400).json({
            message: "missing_selector",
        });
    }

    try {
        console.log(`Dealing with ${JSON.stringify(req.body)}`);
        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.goto(req.body.url);

        const getContent = async () => {
            return await page.$eval(
                req.body.htmlSelector,
                (element) => element.innerHTML
            );
        };

        page.on("error", () => {
            res.status(500).json({
                message: "page_error",
            });
            page.close();
        });

        if (req.body.consoleMatch) {
            page.on("console", async (consoleObj) => {
                if (page.isClosed() === false) {
                    if (consoleObj.text() === req.body.consoleMatch) {
                        res.json({
                            html: await getContent(),
                            type: "consoleMatch",
                        });
                        page.close();
                    }
                }
            });
        }

        if (req.body.waitSeconds && typeof req.body.waitSeconds === "number") {
            setTimeout(async () => {
                if (page.isClosed() === false) {
                    res.json({
                        html: await getContent(),
                        type: "waitSeconds",
                    });
                    page.close();
                }
            }, req.body.waitSeconds * 1000);
        }

        setTimeout(async () => {
            if (page.isClosed() === false) {
                res.json({
                    html: await getContent(),
                    type: "timeout",
                });
                page.close();
            }
        }, TIMEOUT * 1000);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "internal_error" });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

process.on("SIGINT", () => {
    process.exit();
});
