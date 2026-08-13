/* A real MQTT broker over websockets, so the ground key can be tested for
   real instead of hoped about.   node pg/tools/broker.mjs 9001 */
import { Aedes } from "aedes";
import { WebSocketServer, createWebSocketStream } from "ws";
import { createServer } from "node:http";

const port = Number(process.argv[2] || 9001);
const aedes = await Aedes.createBroker();
const server = createServer();
const wss = new WebSocketServer({ server, handleProtocols: () => "mqtt" });

wss.on("connection", (ws) => {
  const stream = createWebSocketStream(ws);
  stream.on("error", () => {});
  aedes.handle(stream);
});
aedes.on("client", (c) => console.log("client", c.id));
aedes.on("publish", (pkt) => {
  if (pkt.topic && !pkt.topic.startsWith("$")) {
    console.log("publish", pkt.topic, "retain=" + !!pkt.retain, (pkt.payload || "").length + "b");
  }
});
server.listen(port, () => console.log("mqtt/ws on ws://localhost:" + port));
