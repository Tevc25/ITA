const fs = require("fs");
const path = require("path");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const isLocalStage = process.env.STAGE === "local" || process.env.USE_LOCAL_DB === "true";
const localDbFile = process.env.LOCAL_DB_FILE || path.join(process.cwd(), "data", "local-db.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureLocalStateFile() {
  const directory = path.dirname(localDbFile);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(localDbFile)) {
    const initialState = {
      users: [],
      parkingLots: [],
      reservations: [],
    };
    fs.writeFileSync(localDbFile, JSON.stringify(initialState, null, 2), "utf8");
  }
}

function readLocalState() {
  ensureLocalStateFile();
  return JSON.parse(fs.readFileSync(localDbFile, "utf8"));
}

function writeLocalState(state) {
  fs.writeFileSync(localDbFile, JSON.stringify(state, null, 2), "utf8");
}

function conditionalCheckFailed(message) {
  const error = new Error(message || "Conditional check failed");
  error.name = "ConditionalCheckFailedException";
  throw error;
}

function localCollectionByTable(state, tableName) {
  if (tableName.endsWith("-users")) {
    return state.users;
  }

  if (tableName.endsWith("-parking-lots")) {
    return state.parkingLots;
  }

  if (tableName.endsWith("-reservations")) {
    return state.reservations;
  }

  throw new Error(`Unsupported local table name: ${tableName}`);
}

function findByKey(collection, key) {
  return collection.find((item) =>
    Object.entries(key || {}).every(([k, v]) => item[k] === v),
  );
}

function removeByKey(collection, key) {
  const index = collection.findIndex((item) =>
    Object.entries(key || {}).every(([k, v]) => item[k] === v),
  );

  if (index >= 0) {
    collection.splice(index, 1);
  }
}

function applyLocalUpdate({ item, input, tableName }) {
  const expr = input.UpdateExpression || "";
  const values = input.ExpressionAttributeValues || {};
  const names = input.ExpressionAttributeNames || {};

  if (tableName.endsWith("-parking-lots")) {
    if (expr.includes("availableSpots = :availableSpots")) {
      item.availableSpots = values[":availableSpots"];
    } else if (expr.includes("availableSpots = availableSpots - :one")) {
      item.availableSpots = Number(item.availableSpots || 0) - Number(values[":one"] || 0);
    } else if (expr.includes("availableSpots = availableSpots + :one")) {
      item.availableSpots = Number(item.availableSpots || 0) + Number(values[":one"] || 0);
    }

    if (values[":updatedAt"]) {
      item.updatedAt = values[":updatedAt"];
    }

    return;
  }

  if (tableName.endsWith("-reservations")) {
    if (expr.includes("evidenceStatus = :uploaded")) {
      item.evidenceStatus = values[":uploaded"];
      item.evidenceObjectKey = values[":objectKey"];
    }

    if (expr.includes("#status = :cancelled")) {
      const statusKey = names["#status"] || "status";
      item[statusKey] = values[":cancelled"];
    }

    if (expr.includes("#status = :expired")) {
      const statusKey = names["#status"] || "status";
      item[statusKey] = values[":expired"];
    }

    if (values[":updatedAt"]) {
      item.updatedAt = values[":updatedAt"];
    }
  }
}

async function sendLocal(command) {
  const input = command.input || {};
  const commandName = command.constructor?.name;
  const tableName = input.TableName;
  const state = readLocalState();

  if (commandName === "PutCommand") {
    const collection = localCollectionByTable(state, tableName);
    const item = clone(input.Item || {});

    if (tableName.endsWith("-users")) {
      removeByKey(collection, { userId: item.userId });
    } else if (tableName.endsWith("-parking-lots")) {
      removeByKey(collection, { parkingLotId: item.parkingLotId });
    } else if (tableName.endsWith("-reservations")) {
      removeByKey(collection, { userId: item.userId, reservationId: item.reservationId });
    }

    collection.push(item);
    writeLocalState(state);
    return {};
  }

  if (commandName === "GetCommand") {
    const collection = localCollectionByTable(state, tableName);
    const item = findByKey(collection, input.Key);
    return { Item: item ? clone(item) : undefined };
  }

  if (commandName === "QueryCommand") {
    const collection = localCollectionByTable(state, tableName);
    const values = input.ExpressionAttributeValues || {};
    let items = [];

    if (input.IndexName === "email-index") {
      items = collection.filter((item) => item.email === values[":email"]);
    } else if (input.IndexName === "reservationId-index") {
      items = collection.filter((item) => item.reservationId === values[":reservationId"]);
    } else if (input.IndexName === "status-index") {
      items = collection.filter((item) => item.status === values[":status"]);
    } else if (input.KeyConditionExpression === "userId = :userId") {
      items = collection.filter((item) => item.userId === values[":userId"]);
    } else {
      throw new Error(`Unsupported local query expression: ${input.KeyConditionExpression || "n/a"}`);
    }

    const limit = input.Limit || items.length;
    return { Items: clone(items.slice(0, limit)) };
  }

  if (commandName === "ScanCommand") {
    const collection = localCollectionByTable(state, tableName);
    return { Items: clone(collection) };
  }

  if (commandName === "UpdateCommand") {
    const collection = localCollectionByTable(state, tableName);
    const item = findByKey(collection, input.Key);
    const values = input.ExpressionAttributeValues || {};
    const names = input.ExpressionAttributeNames || {};

    if (!item) {
      if ((input.ConditionExpression || "").includes("attribute_exists")) {
        conditionalCheckFailed("Item does not exist");
      }
      throw new Error("Item not found for update");
    }

    if ((input.ConditionExpression || "").includes("availableSpots > :zero")) {
      if (Number(item.availableSpots || 0) <= Number(values[":zero"] || 0)) {
        conditionalCheckFailed("No available spots");
      }
    }

    if ((input.ConditionExpression || "").includes("#status = :active")) {
      const statusField = names["#status"] || "status";
      if (item[statusField] !== values[":active"]) {
        conditionalCheckFailed("Status is not active");
      }
    }

    applyLocalUpdate({ item, input, tableName });
    writeLocalState(state);

    if (input.ReturnValues === "ALL_NEW") {
      return { Attributes: clone(item) };
    }

    return {};
  }

  throw new Error(`Unsupported local command: ${commandName}`);
}

const dynamoClient = new DynamoDBClient({});

const awsDdb = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const ddb = isLocalStage
  ? {
      send: sendLocal,
    }
  : awsDdb;

module.exports = {
  ddb,
  isLocalStage,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
};
