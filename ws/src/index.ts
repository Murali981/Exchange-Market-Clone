import { WebSocketServer } from "ws";
import { UserManager } from "./UserManager";

const wss = new WebSocketServer({ port: 3001 });

wss.on("connection", (ws) => {
  // Whenever a user connects then we simply do this UserManager.getInstance().addUser(ws) line and this is a singleton
  // pattern where it makes sure that you don't create multiple instances of the UserManager class
  UserManager.getInstance().addUser(ws);
});
