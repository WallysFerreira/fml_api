import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  console.log("requestChange");
  console.log(event);
  let body = "Change requested";
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const controllerConnectionID = event.requestContext.connectionId;
  const client = new ApiGatewayManagementApiClient({ endpoint: `https://${domain}/${stage}` });
  const eventData = JSON.parse(event.body).data;
  
  const board = await getBoard(eventData.boardID);
  console.log(board.connectionID);
  if (board == undefined) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Board not registered",
      }),
    };
  } else if (!board.connectionID) {
    console.log("Board is not connected right now");
    
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Board is not connected right now",
      }),
    };
  }
  
  const controller = await getControllerByConnectionID(controllerConnectionID);
  if (controller == undefined) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Controller not registered"
      })
    };
  }
  
  /*
  if (eventData.change.attribute != "power" && (eventData.change.value < 0 || eventData.change.value > 255)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Value should be between 0 and 255"
      })
    };
  }
  */
  
  if (eventData.change.attribute == "rgb") {
    let invalid = false;
    
    eventData.change.value.forEach((rgbVal) => {
      if (rgbVal < 0 || rgbVal > 255) {
        invalid = true;
      }
    });
        
    if (invalid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Value should be between 0 and 255"
        })
      };
    }
  } else if (eventData.change.attribute == "power" && (eventData.change.value < 0 || eventData.change.value > 100)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Value should be between 0 and 100"
      })
    };
  }
  
  const message = {
    requestedBy: controller.email,
    attribute: eventData.change.attribute,
    value: eventData.change.value,
  };
  
  console.log(JSON.stringify(message));
  
  const command = new PostToConnectionCommand({
    ConnectionId: board.connectionID,
    Data: JSON.stringify(message),
  });
  
  try {
    await client.send(command);
  } catch (err) {
    console.log(err);
    body = err;
  }
  
  return {
    statusCode: 200,
    body
  };
};

async function getBoard(boardID) {
  const command = new GetCommand({
    TableName: "Boards",
    Key: {
      partitionKey: boardID,
    }
  });
  const response = await docClient.send(command);
  
  return response.Item;
}

async function getControllerByConnectionID(connectionID) {
  const command = new ScanCommand({
    TableName: "Controllers",
    FilterExpression: "connectionID = :connID",
    ExpressionAttributeValues: { ":connID": connectionID }, 
  });
  const response = await docClient.send(command);
  
  return response.Items[0];
}