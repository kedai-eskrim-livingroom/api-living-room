import express from "express";
import cors from "cors";
import { config } from "dotenv";
import route from "./src/routes/route.js";
import http from "http";
config({ path: ".env" });

const app = express();
const port = process.env.PORT;
const server = http.createServer(app);

server.timeout = 300000;

app.use(express.json());
app.use(cors());

app.use("/api", route);


app.get("/", (req, res) => {
    res.status(200).send({ message: "BKS SHIPMAN API" });
});

server.listen(port, () => {
    console.log(`Server running on [http://127.0.0.1:${port}]. \nPress Ctrl+C to stop the server`);
});